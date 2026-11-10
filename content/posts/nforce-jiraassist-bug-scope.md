---
title: "天花板数的是 bug，搬过去的也必须是 bug"
slug: "nforce-jiraassist-bug-scope"
date: 2026-11-10T17:20:00+08:00
lastmod: 2026-11-10T17:20:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "「Open now 加上 Type = bug」，一个词的改动。但如果只窄化计数、不窄化搬运，天花板就成了单向玻璃——被搬来的人看得见票，票却看不见天花板。"
showToc: true
---

两句话的需求：

```
1) what each person carries 里的 Open now，加上 Type = bug
2) status not in (Cancelled, "not in nova-x scope") 改成 status not in (Cancelled, "not in nova-x scope", Cancel)
```

按字面改，只需要在 `openJql` 里插一段 `AND issuetype = Bug`。我没那么做，理由和一个星期前"六段过滤不写两遍"是同一个。

## 只改计数，会造出一块单向玻璃

rebalance 里两条查询：

| 查询 | 干什么 | 谁在用 |
|------|--------|--------|
| `openJql` | 某人**现在手上**有多少票、多少 cost | 天花板检查、Before 列 |
| `batchJql` | 这批票里**哪些可以被搬走** | 计划候选 |

如果只给 `openJql` 加 `issuetype = Bug`：

- 天花板 = 这个人手上有 **8 个 bug**
- 候选 = 全类型的未解决票，**含 incident、service request、task**
- 于是计划可以把一个非 bug 推进来：接收方的天花板**看不见它**，数字不变，人却满了

这就是单向玻璃。被搬票的人看得见票，票看不见天花板。

天花板既然数的是 bug，可搬的也得是 bug。所以条件写进**共享的 `scopeJql`**：

```json
"scopeJql": "project = \"nova-X Production Support\" AND issuetype = Bug AND status not in (Cancelled, \"not in nova-x scope\", Cancel) AND component in (COM, \"CIM/C360\", \"CIM/CASE\", \"CIM/OPP\", Coupon) AND created >= \"2026-01-01\"",
"openJql":  "assignee = {person} AND resolution is EMPTY AND {scope}",
"batchJql": "assignee is not EMPTY AND resolution is EMPTY AND {scope} ORDER BY priority DESC, key ASC"
```

`{scope}` 一展开，Open now 印在页面上的那句话里就带着 `issuetype = Bug`——说明和数字还是同一个来源。

## `'Cancel'` 不是 JQL 字符串

需求里写的是 `'Cancel'`。Jira 的 JQL 只有**双引号**表示字符串，单引号不是合法定界符；写了要么语法错，要么被当成裸标识符的一部分。

项目里另外那份 `jql-template.json`（历史周报模板）一直是这么写的，可以参考：

```
... AND status not in (Cancel, Cancelled, "not in nova-x scope")
```

`Cancel` 是个没有空格、没有特殊字符的状态名，裸写就行。所以落成 `status not in (Cancelled, "not in nova-x scope", Cancel)`——只有带空格的那个需要引号。

顺带一句：`Cancel` 和 `Cancelled` 在同一个站点里是两个不同状态（老状态 + 新状态），这也是为什么这段过滤会同时出现两个词。少写一个，就会有一批票一直挂在"未解决"里虚增负载。

## 页面文案也得跟着改

原来那句说明是：

> Open now counts the **tickets** still assigned to that person and not yet resolved

加了 bug 条件之后，这句话就变成假话了——它数的是票，但只数 bug。改成：

> Open now counts the **bugs** still assigned to that person and not yet resolved

这不是文字游戏。上一版专门把 `openJql` 的原文印在表头上，就是为了让"说明"和"数字"永远同源；说明里偷偷换了统计口径而不改字，等于把刚建立的信任拆掉。

## 测试：断言它**在** scope 里，也断言它**不在** openJql 里

```js
assert.match(DEFAULT_REBALANCE.scopeJql, /issuetype = Bug/);
assert.match(DEFAULT_REBALANCE.scopeJql, /status not in \(Cancelled, "not in nova-x scope", Cancel\)/);
assert.ok(!/issuetype/i.test(DEFAULT_REBALANCE.openJql), 'the bug filter belongs to the shared scope');
```

第三条是最有价值的。半年后有人觉得"这不就是 Open now 的口径吗，挪进 `openJql` 更直观"——挪完测试立刻红，注释就写在断言旁边：

> the ceiling counts bugs, so the candidates have to be bugs.

另外还断言了展开后的 Open now 查询里确实出现 `issuetype = Bug`：页面印出来的那句话，和它解释的那个数字，必须是同一条查询。

## 证据

- **615 组单测**全绿（scope 那组从"五段条件"扩到"七段"，并新增"不许出现在 openJql"的反向断言）
- **265 个变异全部被预期断言抓住**
- `npm run check` / `build` / `npm run verify`（真 Chrome，9 个页面冷启动）全绿
- 合入 PR #85，发版 PR #86 → tag `v1.14.13`，`release.yml` 发布产物
  `nforce-jiraassist-v1.14.13.zip`（582 KB，41 个文件）

## 你可能想调的地方

- **`issuetype = Bug` 的写法**：JQL 里值大小写不敏感，但类型名和你站点的实际名称要对得上（`Bug` / `bug` 都行，`Defect` 就不行）。
- **只想让 Open now 只看 bug、候选保持全类型**：把 `issuetype = Bug` 从 `scopeJql` 挪到 `openJql` 的 `AND {scope}` 之前。可以，但要知道代价——天花板和被搬的票就不是同一批了，见上面那块单向玻璃。
- **`Cancel` 还想再多排几个状态**：直接往 `status not in (...)` 里加。注意 `resolution is EMPTY` 通常已经盖住了 `Closed`/`Done`，重复列不会更安全，只会更难读。

---

一个词的过滤条件，改了三个地方：它在哪、它怎么引号、它旁边那句话怎么念。三处不一致，数字就开始骗人。
