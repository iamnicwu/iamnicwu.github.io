---
title: "在 Jira 里加一个悬浮按钮：少点两步"
slug: nforce-jiraassist-corner-launcher
date: 2026-11-07T23:50:00+08:00
lastmod: 2026-11-07
draft: false
tags: ["Jira", "Chrome 扩展", "效率工具"]
summary: "在 Jira 页面右下角放一个圆按钮，点开就是 Dashboard / Trends / Rebalance / Bulk。它复用已有的注入脚本，而不是为它再开一个 content script——后者要新付三份代价。"
showToc: true
---

功能越小，越容易看出一个人怎么权衡。这个按钮只有一件事：让人在 Jira 里少点两步。

原来的路径是：工具栏图标 → popup → Dashboard。三步，而且第一步藏在浏览器右上角一堆图标里。可是看周报的人，八成时间就停在 Jira 的某个 issue 页上——他离报告只差一个入口。于是右下角多了一个圆按钮，点开是四项：Dashboard、Trends、Rebalance、Bulk actions。

## 只有四项，不是六项

扩展一共有七个页面（外加 popup）。菜单里只放四个：

- **Dashboard / Trends / Rebalance / Bulk** 是「顺手看一眼」的目的地；
- **Settings 和 Incident audit** 是「专门去办」的事，不该出现在一个覆盖在当前 issue 上的小面板里。

这条线不画的话，右下角就会长成第二条侧栏——而侧栏已经在页面左边了，两条重复的导航，其中一条还压着正在读的内容。

## 为什么塞进已有的注入脚本

直觉是「一个新文件更干净」。但在这个扩展里，多一个 content script 要付三份代价：

1. `vite.content.config.mjs` 用 `format: 'iife'` + 固定输出名（`content/jira-msg.js`），因为 content script 不能是 ES module、也不能和别的文件共享 chunk。加第二个入口就要把 `entryFileNames` 改成 `[name]`，并确认打包闭合仍然精确。
2. 它必须在 `REGISTERED_SCRIPTS` 里登记，否则打包器会把它当 stray 丢掉——这是个只在安装后才暴露的坑。
3. worker 里多一处注册、多一处注销（站点或权限消失时要撤掉）。

为一个按钮付这些，不划算。所以按钮就住在 `content/jira-msg.js` 里——同一份注册、同一个 shadow root 纪律、同一个 `call()` 通道。代价是那个文件从此有两个职责，我在文件头把这件事写清楚了，而不是让它变成「为什么预览脚本会画按钮」这样的悬案。

## 两个小决定

**标签和动作不新造一份。** 菜单项来自 `lib/nav.js` 的 `NAV_PAGES`（`id` + `label` + `open`），和左侧栏同一份数据。点击走 `api[page.open]()`，和侧栏同一条通道。测试断言：菜单里每一个 id 都能解析到一个真实的 `api` 方法——因为「按钮发了条没人处理的消息」是完全静默的失败，界面一切正常，只有控制台知道。

**挂载纪律照抄面板那套。** 一个固定 host id（Jira 是单页应用，重复挂载会长出第二个按钮）、一个 shadow root、一张 `CSSStyleSheet`（页面的 CSP 管不到 CSSOM）、`aria-expanded` 跟着开合走、Escape 或点外面都关掉。它是画在别人的页面上的，任何一点「抢事件」的行为都会被记恨。

## 怎么验证的

单元测试守住三件可测的事：id 都能解析、markup 会转义且默认关闭、挂载被 host id 挡住不会重复。

真浏览器那层多加了一步：把**构建产物**里的 `content/jira-msg.js` 装进一个页面，点一下按钮，断言「挂上了 → 至少三项 → 关→开→关 → 全程无异常」。它不是 Jira 页面，所以只覆盖了挂载这半边；读 `.msg` 的那半边仍然要有真实站点才算数——但「按钮根本没出现」这种失败，从此不用等到装到 Jira 上才发现。

> 一句话：能复用现有注册的，就别新开一条链路；省下的不是代码量，是「以后每次改都要记得改两处」。
