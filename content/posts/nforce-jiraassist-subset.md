---
title: "一个组不等于一份名单：只给其中几个人分配"
slug: "nforce-jiraassist-subset"
date: 2026-11-24T09:30:00+08:00
lastmod: 2026-11-24T09:30:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "分配计划原来只能整组来：lookup 表里写着谁是哪个组，于是走了的人、请假的人、不该接故障的 leader 全都在计划里。现在名单上的每个名字都是一个开关。"
showToc: true
---

Rebalance 页面上，「可分配的人」一直是从 lookup 表读出来的：表里写着谁属于哪个组，选一个组，整组人都进计划。

问题在于，**组是报表单位，不是决策**。

走了两个月的人还在表里；这个月在休假的也在；组长不该被塞故障单。这些人在计划里每一个都会**多一条 load 查询**（要数他手上现在有几张票），并且都可以成为「搬到谁头上」的候选。

所以这一版把名单变成了开关。

## 名单是开关，不是标签

原来的名单是一串只读的 chip：

```js
`<span class="chip text-xs" title="...">${name} <span>${key}</span></span>`
```

现在是 `<button aria-pressed>`：

```js
const on = state.picked.has(key);
`<button type="button" class="chip text-xs${on ? '' : ' chip-quiet chip-off'}"
        data-person="${key}" aria-pressed="${on ? 'true' : 'false'}">${name}</button>`
```

三个细节值得说：

1. **`aria-pressed` 是给读屏的**，视觉上靠「实心 vs 描边 + 删除线」。只靠透明度区分「在计划里 / 不在」在投影仪上等于没有。
2. **`All` / `None` 一键**，因为真实操作是「默认全选，去掉两个人」，不是「从零挑两个人」。
3. **标题行写 `2 of 4 in play`**。缩圈这件事永远不能静默——不然你以为在调四个人，其实只调了两个。

## 空选择必须被拒绝，而不是给出空表

一个容易写错的分支：什么都没选的时候会发生什么？

顺手写成「没有人 → 计划里没有 move」，界面会得到一张空表。问题是，**空表在这页上的含义是「这周不需要搬」**，那是一件完全不同的、而且会被念进会上的事。

所以空选择是错误，不是结果：

```js
if (Array.isArray(only) && !picked.people.length) {
  throw new JiraError('No colleague is selected', {
    hint: 'Tick at least one name in the list, or press "All" to start from the whole group.',
  });
}
```

同理，`selectPeople` 里的空数组**不等于**「所有人」：

```js
if (!Array.isArray(only)) return { people: all, missing: [] };  // 调用方没问 → 整组
if (!wanted.length) return { people: [], missing: [] };         // 明确选空 → 没有人
```

这两个入参只差一个 `null` 和一个 `[]`，含义相反。这种地方不写清楚，下一个人一定会把 `[]` 当成「全部」。

## 子集要在查之前收窄

收窄发生在 worker 拿到名单之后、任何查询之前：

```js
const picked = selectPeople(people, only);
const inPlay = picked.people;

const loadsResult = await loadsForEveryone(settings, inPlay, config, impactId);
const plan = buildPlan({ tickets, people: inPlay, loads, config });
```

一行之差，效果是：被排除的人**不花一条 load 查询**，也不出现在计划表里，也不可能成为目标。

也正因为只在一处定义「在计划里」，下游三处（load、候选票、可接收的人）不会各自判断、各自跑偏。这类「同一个概念有好几个判定点」的 bug 最难查——上周那个 tooltip 转义和消息鉴权都是同一个毛病。

## 三个层次的断言

一个交互改了三层，就在三层各钉一颗钉子：

| 层 | 断言 |
|---|---|
| 纯函数 | 子集保持组内顺序、找不到的 key 被列出来而不是悄悄丢掉、`[]` 与 `null` 含义相反 |
| worker | 传 `only: ['u1']` 时，请求里**没有** `u2`/`u3`，计划里只有一个人；传 `only: []` 被拒并给出出路 |
| 真浏览器 | 点 `None`：全部变成 `aria-pressed="false"`、Build 变灰、标题变 `0 of 2 in play`；点 `All`：恢复 |

第三条是这次新加的。之前 `verify-ui.mjs` 只**读**名单（名字对不对、hover 有没有 ceiling），这一版它开始**点**名单——一个截图证明不了「点了以后按钮会禁用」。

## 顺带一个产物

`screenshots/rebalance.png` 现在由门禁自动生成，跟 settings、categorise 一样。界面改动本来就该有一张能被翻出来的图，尤其是这种「状态在不在」靠一眼判断的改动。

## 结果

- 654 组断言（+2：选择函数、worker 子集）
- 289 个变异全部命中（+2：忽略子集、空选择放行）
- `check` / `build` / `verify`（真 Chrome，十页）全绿

版本 `v1.14.22`。
