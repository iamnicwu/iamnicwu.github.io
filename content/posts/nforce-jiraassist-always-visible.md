---
title: "不该藏的东西别藏：按钮组为什么总是要刷新才出现"
slug: "nforce-jiraassist-always-visible"
date: 2026-11-27T11:40:00+08:00
lastmod: 2026-11-27T11:40:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "上一版我给它加了路由监听，用户还是得刷新。因为真正的问题不是「没监听到路由」，而是「把可见性挂在一个来得比渲染晚的东西上」。这次不再藏了。"
showToc: true
---

上一版我给这个按钮组加了三层监听：`pushState`、`replaceState`、`popstate`。用户反馈：**还是要刷新。**

我修错了地方。

## 原来的设计

```js
const issueKeyNow = () => /\/browse\/([A-Z]+-\d+)/.exec(location.pathname)?.[1] || '';

const syncSteps = () => {
  stepsRow.hidden = !issueKeyNow();   // 不在工单页就藏起来
};
```

想法是好的：三个「一键分配」按钮只在工单页有意义，别的地方显示出来是噪音。

问题在**时机**。Jira 是单页应用，从列表点进一张票的过程是：

1. URL 变（`pushState`）
2. 我收到通知 → 读 `location.pathname`
3. Jira 渲染新视图

第 2 步和第 3 步之间，DOM 还是旧的，但 `location` 已经是新的——所以**读到的其实是新 URL**（这点没错），藏起来的原因不在这里。

真正的原因在另一头：路由变化会触发 Jira 重新渲染，**某些视图会整块替换 `<body>`**。我们的宿主 `div` 挂在 `document.documentElement` 上，有些渲染把它一起扔了。宿主没了，按钮组自然没了，而路由监听只负责"改显隐"，不负责"重新挂载"。

刷新能恢复，是因为整页重载会重新注入内容脚本、重新挂载宿主。

## 两层错误

**表层**：路由监听只管显隐，不管挂载。

**底层，也是更值得说的**：**我把"可见性"挂在一个比渲染更晚才确定的条件上。**

只要按钮组的显示依赖"脚本判断出这是工单页"，那么凡是"脚本判断的时刻"与"页面渲染的时刻"不一致的场景，都会出现"藏起来了但不会再显示"。单页应用里这种时刻非常多：前进、后退、程序导航、局部刷新、保活恢复。

修法有两种：

1. 把所有时刻都监听一遍（上一版做的，永远漏一个）
2. **不依赖那个条件**（这一版做的）

## 现在怎么做的

**按钮组永远显示。**

```js
if (stepsRow) stepsRow.title = 'Applies to the issue in this tab';
```

标记里 `<div class="jl-steps">` 不再带 `hidden`。不在工单页点它，状态行会说 `no issue on this page`——**看得见的失败比看不见的按钮好**：看得见，人就去找原因；看不见，人只记得"这功能时灵时不灵"。

真正的关键在于：**显示与目标分开了。**

- "要不要显示" → 恒定，与任何时刻无关
- "这张票是哪张" → 点击时才读 `location`，永远是最新的

```js
button.addEventListener('click', async () => {
  const key = issueKeyNow();      // 点的那一刻读，不是挂载时读
  if (!key) { say('no issue on this page'); return; }
  …
});
```

挂载时读 key 才是真的会出错：那样的话，你在 A 票上打开页面、切到 B 票、再点按钮，会改到 A。

## 挂载的自愈：三种触发，一个动作

```js
const ensureLauncher = () => {
  if (!document.getElementById(LAUNCH_HOST_ID)) mountLauncher();
};
```

- `pushState` / `replaceState`：包一层，因为它们本身不触发任何事件
- `popstate`：后退
- 每 2 秒查一次：覆盖"没改 URL 但把 body 换了"的渲染

三种触发走同一个幂等函数。每 2 秒一次 `getElementById` 是这页上最便宜的事；而"宿主不见了"和"从没挂载过"在代码里长得一样，除了问文档没有别的办法分辨。

顺带修了个隐患：这些监听**注册在模块级、由 `window.__jiraAssistWatchdog` 标记**。上一版把 `setInterval` 写在挂载函数里——每次重新挂载就多一个定时器，三次导航后每 2 秒跑三个。这种泄漏不会报错，只会在几个月后变成"这插件有点卡"。

## 一个顺手发现的时序坑

验证脚本里有一条"全新安装应该带着自带的名单"。这次它红了：

```
A fresh install should carry the shipped team list, got: Nothing imported yet.
```

原因是种子写入是**异步的**（一次 fetch + 两次 storage 写），而检查在页面 paint 之后立刻读。上一版能过，是恰好赢了这个竞态。

产品上不会出这个问题——安装处理器里先播种，再 `openOptionsPage()`。但"恰好能过"的测试和"真的能过"是两件事，所以改成轮询等待（最多 6 秒），并在注释里写清为什么等：**问的是"装完打开设置的人会看到什么"，不是"paint 后 5 毫秒内存里是什么"。**

## 结果

- 662 组断言（+1：按钮组在标记里就是可见的，谁把它塞回 `hidden` 谁红）
- 300 个变异全部命中（+1：把 `hidden` 加回去）
- `check` / `build` / `verify`（真 Chrome，十页）全绿

版本 `v1.14.29`。
