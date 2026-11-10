---
title: "让分配方案里有名字：key、name、prefer modules"
slug: "nforce-jiraassist-lookup-name-preference"
date: 2026-11-10T12:10:00+08:00
lastmod: 2026-11-10T12:10:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "一张表里，工号用来写、名字用来读、偏好模块用来判断。三个字段各管一件事，混在一起就会把「Alice Wong」发给一个只认 82012717 的接口。"
showToc: true
---

上一版把 lookup 表简化成了两列：`key, value`。key 是员工编号，value 是组。

结果很快就撞上两个问题，都是使用上的，不是逻辑上的：

1. **方案读不懂。** 「把 A-1234 从 `82012717` 移到 `82017576`」——看的人得先去别处查这两个号是谁。
2. **没法判断该不该移。** 每个人负责哪些模块，只在别人脑子里；每次都要另开一个页面找。

所以加了两个可选列：

```csv
key,value,name,prefer modules
82012717,(CBG)PCD,Alice Wong,Payments; Settlements
82017576,(CBG)PCD,Bob Chan,Network
82012791,(CBG)LTS,Carol Lee,
```

- `name`：这个人叫什么。只用于显示。
- `prefer modules`：团队自己写的「他管哪块」。也只用于显示。

**两列都不参与任何决策。** 权重、间距、选谁……全部逻辑不读它们。理由是：一旦「偏好」参与了算法，它就会变成一条隐性规则，而团队并没有同意过这条规则。它该做的是让人在按下确认前看一眼。

## 最难的一处：`name` 有两个含义

代码里 `person.name` 之前指的是**写入 Jira 时用的标识符**。现在表里又有一个 `name` 是**给人看的名字**。如果偷懒合并成一个字段：

```js
// 看起来无害，实际会把任务发给一个不存在的人
await assignIssue(settings, issueKey, { name: person.name });  // "Alice Wong"
```

Jira 只认 `82012717`。

所以两个字段分开：

| 字段 | 是谁 | 用在哪 |
|---|---|---|
| `key` | `82012717` | 查询、写入、匹配 |
| `name` | `82012717`（标识符） | 保持原义，不动 |
| `displayName` / `label` | `Alice Wong` | 页面显示 |

这一条写成了断言：`person.name` 仍然是标识符，`person.label` 才是名字。测试里专门有一个「无 name 列时 plan 仍可读」的用例，防止有人顺手把两个字段并回去。

## 解析：命名的列优先于位置

支持两种形状：

```
key,value,name,prefer modules              ← 人名单
attribute,key,value,name                   ← 带属性的通用表
```

关键是**先按列名匹配，再按位置兜底**。否则四列表会被当成 `attribute,key,value` 读——人名塞进分组列，偏好被丢掉，而导入还是「成功」的。

还有一个向后兼容的细节值得写出来：**只有当文件真的有这一列时，entry 上才会出现这个字段。**

```js
...(nameIdx >= 0 ? { name: row[nameIdx].trim() } : {}),
```

不写成 `name: ''`，因为「这张表没有名字列」和「有名字列但没人填」是两件不同的事。顺带的好处是：老表的存储字节一个都没变，所有 `deepEqual` 断言原样通过——这是**改动范围的证据**，不是巧合。

## 页面上的三处

| 位置 | 显示 |
|---|---|
| 选完组后的名单 | chip 显示 `Alice Wong 82012717`，hover 里带偏好模块 |
| Build the plan 的每人一行 | 姓名在上、工号在下（等宽小字），旁边单独一列 **Preferred modules** |
| 设置页的导入预览 | 文件有这两列才显示，没有就不显示 |

移动表格（The moves）本来就用 `personLabel`，所以「From / To」自动变成 `Alice Wong → Bob Chan`，不用改。

有个小坑被抓到了：chip 里姓名和工号之间只有 CSS `margin`，视觉上分开，但 `textContent` 拼出来是 `Ana Ruizana`——复制和读屏都会粘在一起。改成真的加一个空格。浏览器验证的日志里就是这个形状，一眼就看出来了。

## 验证

- **611 组单测**（新增 2 组：四列导入与三种旧形状不变；plan 携带 label/preferModules 且 `name` 仍是标识符）
- **265 个变异全部被预期断言抓住**
- `npm run verify` 全绿，7b 现在往夹具里写名字，并断言名单打印 `Ana Ruiz ana / Bo Chen bo`
- 产物 `nforce-jiraassist-v1.14.9.zip` + sha256

---

三个字段，三件事：**key 用来写，name 用来读，prefer modules 用来判断**。分清楚它们，比多加一列更重要——因为合并它们的代价不是页面少一列，而是某天任务被派给了一个查无此人的名字。
