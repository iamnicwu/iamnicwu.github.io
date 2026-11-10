---
title: "一条六段过滤写两遍，一定会漂"
slug: "nforce-jiraassist-scope-jql"
date: 2026-11-10T16:10:00+08:00
lastmod: 2026-11-10T16:10:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "把团队真正在干的那些票圈出来，一共六段条件。我把它写成一个变量，因为写两遍的那份一定会和第一份不一样。"
showToc: true
---

「Open now」的取数需要跟团队的实际工作范围对齐：

```
project = "nova-X Production Support"
AND status not in (Cancelled, "not in nova-x scope")
AND component in (COM, "CIM/C360", "CIM/CASE", "CIM/OPP", Coupon)
AND created >= "2026-01-01"
```

六段条件。而 rebalance 里其实有**两个**查询：

1. **每人负载**（Open now）：`assignee = <他> AND resolution is EMPTY`
2. **候选票**（可以移动的票）：`assignee is not EMPTY AND resolution is EMPTY`

直觉做法是两处都粘上这六段。我没那么做。

## 为什么不能粘两遍

这两个查询必须**选中同一批票**。

- 负载按窄范围算、候选按宽范围取 → 计划会去搬这个团队根本没在看的票
- 负载按宽范围算、候选按窄范围取 → 明明眼前有票，计划却说「没得移」

它们是一件事的两半。而六段过滤写两遍，第二遍迟早和第一遍不一样——不是会不会，是时间问题：有人加了个组件，改了负载那条，忘了候选那条。

所以写一次：

```json
"scopeJql": "project = \"nova-X Production Support\" AND status not in (Cancelled, \"not in nova-x scope\") AND component in (COM, \"CIM/C360\", \"CIM/CASE\", \"CIM/OPP\", Coupon) AND created >= \"2026-01-01\"",
"openJql":  "assignee = {person} AND resolution is EMPTY AND {scope}",
"batchJql": "assignee is not EMPTY AND resolution is EMPTY AND {scope} ORDER BY priority DESC, key ASC"
```

`{scope}` 由 `applyScope()` 展开。

## 空范围要能表达

`scopeJql: ""` 是合法配置——意思是不限范围，全项目均衡。

这时候如果只是 `replace('{scope}', '')`，就会留下：

```
assignee = {person} AND resolution is EMPTY AND
```

JQL 语法错误。而且在屏幕上，这句话看起来像 **「查询坏了」**，而不是 **「范围是空的」**——两种情况的下一步完全不同（一个去查语法，一个去改配置）。

所以空值时把整段子句（连同 `AND`）一起删掉：

```js
return text
  .replace(/\s+AND\s+\{scope\}/i, '')
  .replace(/\(\s*\{scope\}\s*\)/g, '')
  .replace(/\{scope\}/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();
```

## 页面：六段条件塞不进一个 input

展开之后，「Tickets to consider」那一栏是完整的一行 JQL，大概 250 个字符。原来是个 `<input>`——它显示两段半，剩下的要横向拖。

换成 `<textarea rows>`，能换行看全。同时「Open now」上面印的那句查询也加了 `whitespace-pre-wrap break-words`，否则会溢出卡片。

**这两处不是美化。** 一个显示不全的查询，等于让人没法核对「你到底在算什么」。

## 一个边界：手改的 JQL 不再套范围

页面上的 JQL 是**展开后**的完整查询。如果用户在里面改了几个字，再点 Build，我不会再套一次 `{scope}`——那会把过滤粘两遍。

```
框里的 JQL 优先，原样执行；
只有用配置里的 batchJql 时才展开 {scope}。
```

## 证据

- **615 组单测**（新增 1 组：五段条件都在、`{scope}` 进到两个查询、`ORDER BY` 在替换后仍完整、空范围不留悬空 `AND`）
- **265 个变异全部被预期断言抓住**
- `npm run check` / `build` / **`npm run verify` 全绿**
- 产物 `nforce-jiraassist-v1.14.12.zip` + sha256

## 你可能想调的地方

- **`created >= "2026-01-01"`**：我按「从 2026 年开始」理解成**创建时间**。如果你要的是「2026 年之后还有人动过的」，改 `updated >= "2026-01-01"`。
- **组件名**：`COM` 这类不带引号是 JQL 的裸标识符，只有含空格或特殊字符的才需要引号（`"CIM/C360"` 带斜杠，所以加了）。如果实际组件名大小写和这里不同，JQL 的 `component in` 是精确匹配，要注意。
- **两个状态**：`Cancelled` 和 `"not in nova-x scope"` 已排除。若还想排除 `Closed`/`Done`，加进 `status not in (...)` 即可——`resolution is EMPTY` 通常已经盖住了。

---

一处配置、两条查询，比两处配置、两条查询，少的不是行数，是一个迟早会发生的分叉。
