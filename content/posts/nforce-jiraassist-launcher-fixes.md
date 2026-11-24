---
title: "白名单也是一种功能：我自己把悬浮菜单弄坏了"
slug: "nforce-jiraassist-launcher-fixes"
date: 2026-11-25T01:40:00+08:00
lastmod: 2026-11-25T01:40:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "安全", "工程实践", "nForce"]
summary: "上周给消息通道加发送者校验，白名单只写了「读附件」。于是悬浮按钮的菜单——四个「打开某页」——全部失效：菜单能弹出来，点下去没反应。这次补上，并顺手把三件别的事一起做完。"
showToc: true
---

上周做安全评审，给 worker 的消息通道加了发送者校验：内容脚本跑在别人的 Jira 页面上，所以它只该做它被注入来做的那件事——读 `.msg` 附件。

```js
const CONTENT_ALLOWED = new Set(['ATTACHMENT_MSG']);
```

这条改动上线后，我自己的悬浮按钮坏了。

## 症状：菜单弹得出来，点不动

右下角那个圆按钮，点开是四个入口（This week / Trends / Rebalance / Bulk actions）。点任意一个，什么都不发生。

因为那四个入口发的消息分别是 `OPEN_DASHBOARD`、`OPEN_TRENDS`、`OPEN_REBALANCE`、`OPEN_BULK`——**四条都被新白名单拒了**。

链路是对的，每一环都对：点击绑定了、`api.openDashboard()` 发出去了、worker 收到了、然后按「页面脚本不许发这个」拒掉、页面侧 `.catch(() => {})` 把拒绝吞了（那里本来是给「标签页没开出来」用的静默）。

**一次静默失败，从点击到结果没有任何地方出声。**

## 教训：白名单要当成一份功能清单来测

修起来是一行——把四个 `OPEN_*` 加进白名单。真正的问题是**白名单里少了东西，没有任何测试会红**。

我当时的守卫测试只断言了两件事：

- 外来扩展的消息被拒 ✓
- 内容脚本发 `CATEGORISE_APPLY` 被拒 ✓

两条都是「应该被拒的确实被拒了」。**没有一条在问「应该放行的，是不是还放行」**——而白名单的失败方向恰恰是后者：漏一条，那个功能就静默死掉。

所以这次补的断言长这样：

```js
for (const type of ['OPEN_DASHBOARD', 'OPEN_TRENDS', 'OPEN_REBALANCE', 'OPEN_BULK']) {
  const menu = ask({ type }, { tab: { id: 3 }, url: 'https://acme.atlassian.net/browse/OPS-1' });
  assert.equal(menu.kept, true, `${type} from the corner menu was refused`);
}
// 菜单里没有的，仍然拒绝：白名单是四条具体的消息，不是「页面脚本可以开标签」
assert.equal(ask({ type: 'OPEN_OPTIONS' }, { tab: { id: 3 } }).kept, false);
```

一句话总结：**允许清单和禁止清单要用同等的力气去测**。禁止清单漏了会被人利用，允许清单漏了会被人当成「功能坏了」——后者通常更早发生，只是没人把它连到那次安全改动上。

## 顺手做的三件

### 1. 名单从一个组变成一张表

Rebalance 页里，选定组之后列出的同事，以前是一排「标签」，上一版改成可点的开关。这版换成表格：

| Available | Person | Key | Preferred modules | On hand limit |
|---|---|---|---|---|
| ☑ | Ana Ruiz | ana | Payments | 10 |
| ☑ | Bo Chen | bo | | 8 |

**默认全勾**，去掉勾就是「这次不给他」。表比一排标签多说了两件事：工号（真正写进 Jira 的是它）和上限（原来要点 hover 才看得到，需要 hover 才能看见的数字等于没有）。

空勾是错误不是结果：一个空表在这页上的意思是「这周不用搬」，那会被念进会上。

### 2. 设置页不再提供 historical workbook

那个面板读的是扩展目录里的 `historical.xlsx`，用途是「把去年的周数字一次补进趋势」。

你的数字从 query 来，就不该再有第二份手工维护的文件。面板连同它的侧栏索引一起删了，设置页从 8 节变 7 节——**连带改了 5 处散文里的「see section 8」**，因为那种引用不会报错，只会把人送到错的段落。

底层那个 xlsx 读取器没删：打包版从来不 ship 这个文件，所以对任何安装版它都不生效。要不要连代码一起删（约 900 行 + 80 条断言），另说。

### 3. 工单页上的三个一键分配

在 Jira 的工单页，悬浮按钮上方多了一行：**Assign · PCD · LTS · CVP7**。

背后是已经存好的 `workflow_steps.json`：定时分配那套是「搜一批票，然后逐个赋值」。站在一张票上时，搜索是多余的那一半——票就在眼前，缺的只是「这步把票给谁」。

于是：

```js
const step = steps.find((item) => item.name.toLowerCase().includes(module.toLowerCase()));
const assignment = step.fields.find((f) => f.field === 'assignee' && f.op === 'set');
await assignIssue(settings, issueKey, { name: assignment.value });
```

**页面能说的只有两件事：哪张票、哪个模块。** 给谁，是从你保存的 workflow 里读出来的——所以这条消息不会变成「页面脚本可以让任何人拿到任何票」。

它也是唯一一条页面脚本可以触发的、真的会写 Jira 的消息。允许它的理由写在白名单的注释里，连同它的边界：值不来自消息。

## 结果

- 657 组断言（+1：一键分配的端到端，含「没有跑任何 search」）
- 294 个变异全部命中（+3：白名单退回一条、没有 assignee 的步骤照写、页面编的 key 照用）
- `check` / `build` / `verify`（真 Chrome，十页）全绿

版本 `v1.14.24`。
