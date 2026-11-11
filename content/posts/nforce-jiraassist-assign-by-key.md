---
title: "名字不是身份：Apply 为什么会说「不允许分给这个人」"
slug: "nforce-jiraassist-assign-by-key"
date: 2026-11-11T15:20:00+08:00
lastmod: 2026-11-11T15:20:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "表里显示的是人名，Jira 认的是工号。这两件事在代码里混成一个字段，于是点 Apply 的时候，请求带着「Alex Chen」出门，回来一句「用户不存在」。"
showToc: true
---

Rebalance 页面上，选好要搬的票，点 Apply，Jira 回了一句拒绝：不允许分给这个人。

票是对的，人也是对的。错的是**发出去的字段**。

## 根因：一个字段干了两件事

计划里每个 move 长这样：

```json
{
  "key": "OPS-101",
  "from": { "key": "82012717", "name": "Ana Ruiz" },
  "to":   { "key": "82017576", "name": "Priya Nair" }
}
```

`to.key` 是工号（lookup 表的 key 列，也是 JQL `assignee = 82017576` 认的东西），`to.name` 是给人看的名字。

页面把 move 交给 worker 时，写的是：

```js
to: { key: move.to.key, name: person?.name || move.to.name, accountId: person?.accountId || '' }
```

而 `person?.name` 来自 `personLabel()`：

```js
function personLabel(person) {
  return person.displayName || person.name || person.key;
}
```

**`displayName` 排在最前面。** 而几个月前我给 lookup 表加了 `name` 列（为了在计划里显示"谁是谁"），于是每个成员都有了 `displayName` —— 于是 `person.name` 变成了「Priya Nair」，于是请求体变成了：

```json
{ "name": "Priya Nair" }
```

Jira 的 assignee 字段要的是 username 或工号。它不认识「Priya Nair」，回答"用户不存在"。而这条错误读起来像权限问题，所以第一反应是去查 token 和角色——查不到的，因为请求从一开始就带错了东西。

这不是新功能的 bug，是**新功能把一个含糊的字段彻底弄含糊了**：`name` 同时意味着"显示名"和"标识"，只要有一个调用方按显示名理解，它就坏。

## 改法：把身份和标签分开

三个地方一起改，缺一处就还会坏：

**1. 计划里显式带上身份。**

```js
to: {
  key: target.person.key,        // 身份：工号
  accountId: target.person.accountId || '',  // Cloud 站点用这个
  name: personLabel(target.person),          // 只用来显示
  ...
}
```

**2. 页面只发身份，不发标签。**

```js
to: { key: move.to.key, accountId: move.to.accountId || '' }
```

`name` 根本不进这个 payload。不是"尽量别用"，是**没有这个字段可用**。

**3. worker 按身份写信，并且拒绝只带名字的请求。**

```js
const target = move.to.accountId
  ? { accountId: String(move.to.accountId) }
  : { name: String(move.to.key) };
```

同时校验：接收方必须有 `key` 或 `accountId`。只有 `name` 的 move 会被整批拒绝，并说明原因：

> `OPS-101 names no recipient — send the person's key or accountId, not their display name`

这是关键的一步。让它发出去、再让 Jira 回一句"用户不存在"，读者会去查权限；在这里拦住，读者去改 payload。**同一件事，两种错误信息的成本差一个下午。**

## 顺手把表也改了

既然真正被写进去的是工号，行里就该显示工号：

```
Priya Nair
82017576
3 / 10
```

上面是名字（用于认人），下面是工号（用于核对"到底写给谁"）。一行里两个都看得见，Apply 之前就能确认，而不是等拒绝回来再猜。

## 还有一层：如果 lookup 表本身就错了

代码修好之后还有一种情况：有人把**显示名填进了 key 列**。那么 `key = "Alex Chen"`，写出去还是被拒。

工号不含空格，名字含。所以计划现在会提前说：

> 2 of 12 key(s) in "Ops" contain a space (Alex Chen, Priya Nair) — a display name is not an assignee. Put the username or employee number in the lookup table's key column.

在计划还在屏幕上的时候说，比在点了按钮之后说有用得多——前者是改一列，后者是查权限。

## 证据

- **626 组断言**（新增 2 组：写出去的请求体确实是 `{name: 工号}` / `{accountId}`，以及只带显示名的 move 被拒；另一组断言 lookup 用名字当 key 时会告警）
- **270 个变异全部被抓**，其中两个直接针对这次的问题：
  - 把 `String(move.to.key)` 改回 `String(move.to.name)` → 断言请求体的那条测试立刻红
  - 把"key 含空格"的过滤关掉 → 告警测试立刻红
- `check` / `build` / `pack` / `verify`（真 Chrome，九个页面）全绿
- tag `v1.14.16`

---

一个字段如果既能当名字又能当标识，它迟早会在某个调用点被当成名字。分开它们不是洁癖，是让"写错"变成一件不可能悄悄发生的事。
