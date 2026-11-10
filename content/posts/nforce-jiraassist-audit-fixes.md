---
title: "一个没有超时的 fetch，等于没有失败"
slug: "nforce-jiraassist-audit-fixes"
date: 2026-11-11T00:20:00+08:00
lastmod: 2026-11-11T00:20:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "功能加到第十几个页面之后，我让助手把代码审了一遍。它翻出六个真洞，其中最大的一个是「什么都没发生」——fetch 没有超时，所以一个挂住的 VPN 能让页面永远转圈。"
showToc: true
---

插件长到 27 500 行、九个页面之后，我做了一次架构审计。结论写在下面，改法也写在下面，包括一处**没改**的。

## 洞一：没有超时的 `fetch` 不是"可能失败"，是"永不失败"

`jira-client.js` 里每一次请求都长这样：

```js
res = await fetch(url, {
  method,
  headers: { ... },
  credentials: auth.credentials,
  cache: 'no-store',
});
```

没有 `signal`。于是当 VPN 半关、或者代理收下隧道之后不再转发时，这个 promise **永远不会 settle**。没有异常，没有超时，重试循环连第一次机会都拿不到——因为它还在等第一次。

用户看到的是一个转圈的页面，日志里什么都没有。这比报错难查一个数量级：报错至少告诉你错了。

改法：

```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
try {
  res = await fetch(url, { ...request, signal: controller.signal });
} catch (err) {
  if (controller.signal.aborted) throw new JiraError(`Jira did not answer within ...`);
  ...
} finally {
  clearTimeout(timer);
}
```

30 秒给普通请求，120 秒给附件（一封 10 MB 的邮件在专线上真的慢，30 秒掐掉会变成"站点不可达"的误报）。

**一个反直觉的决定：超时不重试。** 重试是给"回答了但答错"准备的（5xx、429）。一个没有回答的请求通常意味着路径没了，三次 30 秒只是把「有问题」拖延成「两分钟后还是有问题」。第一次就失败，VPN 回来的那一刻用户就能重试。

## 洞二：一个人的查询，问了一整个团队的人

Rebalance 要算"每个人手上现在有多少票"，之前的写法是：

```js
for (const person of people) {
  const load = await personLoad(settings, person, config, impactId);
}
```

十二个人就是十二次串行搜索。而这件事 JQL 一次就能答：

```js
assignee in ("u1", "u2") AND resolution is EMPTY AND {scope}
```

**但批量不是把 `{person}` 换成列表。** `assignee = "a", "b"` 不是合法 JQL——要改写的是**子句**，不是占位符。而且只能改写它看得懂的形状：

```js
if (jql.split('{person}').length !== 2) return null;      // 恰好一个占位符
if (!/\bassignee\s*=\s*\{person\}/i.test(jql)) return null; // 而且就是能改的那句
```

`assignee was {person}` 是合法 JQL，意思不同；`assignee = {person} OR reporter = {person}` 是两个人。这两种一律拒绝改写，退回到"每人一次搜索"——慢，但对。页面会说一句"这次是逐个算的"，因为一个慢下来的计划和一个坏掉的计划在屏幕上长得一样。

关键不是快了多少，是**两条路径必须算出同一个数**。所以测试不是断言一个写死的总数，而是断言它等于 `summarizeLoad` 本身：

```js
assert.deepEqual(loads.u1, summarizeLoad([{ impact: 'High' }, { impact: '' }], DEFAULT_REBALANCE));
```

硬编码的期望值会和代码一起漂，而"两条路必须相等"这句话不会。

## 洞三：写路径完全信任页面

`REBALANCE_APPLY` 之前是这样的：

```js
const list = (Array.isArray(moves) ? moves : []).filter((move) => move?.key && move?.to);
```

页面给什么就写什么。页面自己决定哪些 move 是对的，worker 连 key 是不是一个 Jira key 都不看。一个渲染 bug 就能把 `../rest/api/2/issue` 变成一次请求，或者把票分给一个不在这个组里的人（lookup 表在计划之后改过一遍，就够触发）。

现在的分工是：**页面决定"搬哪些"，不决定"什么算合法"**。

- key 必须匹配 `^[A-Z][A-Z0-9_]*-\d+$`
- 接收方必须有可用身份（accountId 或 name）
- 一次最多 200 条（计划是拿来审的，不是拿来批处理的）
- 页面如果自报了部门，每个接收方必须**现在**还在这个组里

一条不合格就整批拒绝，并列出前五条。静默丢掉坏行、把剩下的写完，是"以为搬了八张、实际搬了六张"的那种 bug。

## 洞四：纯计算模块在 import storage 层

`analytics.js`、`charts.js`、`importer.js`、`incident-audit.js`、`normalizer.js`——五个纯计算模块，为了 `PLACEHOLDER` 和 `DATASET_KIND` 两个常量，`import` 了 `config.js`。而 `config.js` 知道 `chrome.storage`、token、环境变量、缓存、数据集。

一个把 issue 分到 ISO 周的函数，离 `chrome.storage` 只有一个 import 的距离。这条边方向是反的。

抽一个 `lib/constants.js`（不 import 任何东西，所以永远不可能进环），`config.js` 继续 re-export 兼容旧路径。五分钟的改动，删掉五条反向依赖。

顺带把 `matchMember` 从 670 行的 `rebalance.js` 里挪到 `lib/members.js`——每日 resolved 那个页面只需要"这是同一个人吗"，不需要整套均衡算法。

## 洞五：单文件上限不是预算

`MAX_DATASET_BYTES` 是 2 MB/文件。于是五个 1.9 MB 的导入**每一个都通过检查**，第五个撞上 10 MB 的区域配额，报一个既没提大小也没提上限的原始错误——在用户选完文件、点了 Import 之后。

per-file cap 和 budget 是两个东西。补上 `datasetBudget(existing, incoming)`：整个区域 8 MB 留给导入（其余留给缓存、基表、日志、设置），并且**同 id 的导入算替换不算新增**，否则"我改了一版重新导入"会被自己上一次的旧副本挡住。

## 洞六：token 对 content script 是敞开的

`storage.local` 默认对 content script 可读，而里面放着 Jira token。content script 跑在别人的页面里——这是整个扩展里唯一一个"隔离"是 Chrome 的承诺、而不是我的代码的承诺的上下文。

```js
await chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
```

`content/jira-msg.js` 本来就不读 storage（连主题都用的页面自己的 `localStorage`），所以这行删掉的是没人用的权限，不是功能。

## 变异测试反过来改了一次代码

给"批量改写"加变异时，我写了一个 `MISS`：

```
MISS the load query is batched even when it names two people
```

意思是"故意改坏这段，没有测试变红"。原因不是我漏了断言，而是我**写了两道重叠的检查**：

```js
const occurrences = jql.match(clause) || [];
if (occurrences.length !== 1) return null;      // 检查一
if (jql.split('{person}').length !== 2) return null;  // 检查二，覆盖了检查一
```

破坏检查一，检查二接住了，所以变异不可见。这类"防御性重复"平时看着很稳，实际上让后来的任何一处修改都无法被验证。最后合并成一句话：

```js
if (jql.split('{person}').length !== 2) return null;   // 恰好一个占位符
if (!clause.test(jql)) return null;                    // 而且就是能改的那句
```

两道检查各管一个问题，各自可被证伪。**变异测试最有价值的产物不是覆盖率，是逼你把重复的防御合并成可验证的一条。**

## 没改的那一件

`screenshots/` 里 4.5 MB 的 PNG 每次发版都会被重新生成并提交——113 次提交里有 53 次改写了它们，`.git` 已经 132 MB，打包后 73 MB。

正确的做法是移出版本库（或 LFS），但那会改动 README 里所有图片链接的渲染结果。这不是技术判断，是文档怎么发布的判断——所以我把它留给你，没有自作主张。

## 证据

- **624 组断言**（新增 9 组：批量改写的形状与拒绝、批量与逐个算的等价性、超时不重试、写路径的四类拒绝、区域预算、storage 权限）
- **268 个变异全部被预期断言抓住**（新增 3 个，其中一个直接把上面那段重复防御逼掉了）
- `check` / `build` / `pack` / `verify`（真 Chrome，九个页面冷启动）全绿
- tag `v1.14.14`

---

加了十几个功能之后再回头看架构，通常会发现两类东西：一类是没写的代码（超时、校验、预算），一类是写多了的代码（重复的防御、反向的依赖）。前者靠补，后者靠删。
