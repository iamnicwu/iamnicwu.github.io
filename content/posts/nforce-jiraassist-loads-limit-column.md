---
title: "一个格子塞三个数字，等于没显示"
slug: "nforce-jiraassist-loads-limit-column"
date: 2026-11-10T15:05:00+08:00
lastmod: 2026-11-10T15:05:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "「把上限显示出来」和「Before 到底是什么」——两个反馈都指向同一件事：数字得能被扫，含义得写在它旁边。"
showToc: true
---

两条反馈，都关于「What each person carries」那张表：

1. **把每个人的 number of tickets on hand 显示出来。**
2. **这里的 before 应该是仍在他名下但没 resolve 的数。**

第一条我上一版其实做了——做成了 `3 · 8 / 10`。一个格子里三个数字：成本、张数、上限。**能算对，但扫不了。** 顺着那一列往下看，眼睛找不到「每个人能接多少」。

第二条我查了一下：`openJql` 一直就是 `assignee = {person} AND resolution is EMPTY`，**数字本来是对的**。但表格只写着 "Before"，没人能从这两个字里看出它是「未解决」还是「全部」。

两件事，一个解法：**把数字拆成能扫的列，把含义写在它旁边。**

## 表变成这样

| Person | Preferred modules | On hand limit | Open now | After | In | Out |
|---|---|---|---|---|---|---|
| Alice Wong<br>`82012717` | Payments; Settlements | 10 | 3 · 8 | 3 · 5 | 0 | 3 |
| Bob Chan<br>`82017576` | Network | 6 | 2 · 6 | 2 · 6 | 0 | 0 |

- **On hand limit** 单独一列，直接是 lookup 里的那个数。`—` 表示没填。
- **Before → Open now**，并且列上面直接印出**实际执行的查询**，不是一句描述：

  ```
  assignee = {person} AND resolution is EMPTY
  ```

  这行是从 `rebalance.json` 的 `openJql` 读出来渲染的。之前副标题里硬写着「resolution is EMPTY」——只要有人改了配置（比如把一个挂起状态排除掉），这句话就会悄悄变成假的，而数字是对的。**说明和数字必须来自同一处。**

- 超限的张数仍然标红（Alice 8/10 没事，如果有人 12/10 就是红的），这样「为什么这张票没动」不用翻到下面的 skipped 列表。

## 一列破折号是个问题，得回答它

用户很可能是**加完列就直接看页面**的——而存储里的行是加列之前导入的，`capacity` 字段根本不存在。于是整列 `—`。

一列 `—` 和「这个功能没做」在屏幕上长得一模一样。所以补一句：

> No ticket limits were read for this group. Add a "number of tickets on hand" column to the lookup table and import it again — the rows already stored predate the column.

这句话只在整组都没有上限时出现，有上限时不留痕迹。

## 顺手记一个门禁里的坑

我在浏览器验证里加了一条断言：页面印出的查询必须含 `resolution is EMPTY`。跑起来却失败，报的是：

```
the loads table does not say what it counts: "a ignee = {per on} AND re t u... "
```

每个 `s` 都不见了。原因还是那个：断言表达式写在普通模板字符串里，`/\s+/` 里的 `\s` 被**先**当成模板字符串的转义吃掉一层，到了浏览器里变成 `/s+/`——把所有字母 s 替换成空格。

改成 `String.raw` 就对了。**同一个坑我第二次踩**（第一次是 7c 的换行符），这次把原因写进了注释。

## 证据

- **614 组单测**（新增 1 组：随包的默认值与 `rebalance.json` 都必须按「未解决」统计）
- **265 个变异全部被预期断言抓住**
- `npm run check` / `build` / **`npm run verify` 全绿**——7b 断言 `On hand limit` 表头存在、且页面印出的查询匹配 `resolution is EMPTY`
- 产物 `nforce-jiraassist-v1.14.11.zip` + sha256

那条单测值得单独说：它守的不是逻辑，是**一个字符串**。`openJql` 是配置项，谁都可以改，但随包的两个地方必须保持「未解决」的读法——因为这决定了整张表的含义，而它离被改掉只有一次编辑的距离。

---

一个格子放三个数字是「算了」，三个格子是「能看」。中间差的不是信息量，是能不能一眼扫过去。
