---
title: "nForce Todo v2.11.1：`#标题` 不打空格也认了"
slug: "nforce-todo-v2-11-1"
date: 2026-11-17T10:17:29+08:00
lastmod: 2026-11-17
draft: false
tags: ["Chrome 扩展", "待办管理", "效率工具", "nForce"]
repo: "https://github.com/iamnicwu/nForce-Todo"
version: "v2.11.1"
summary: "`#标题` 不打空格也认了。"
showToc: true
cover:
  image: "/post-images/nforce-todo-v2-11-1/01-popup.png"
  alt: "nForce Todo 弹窗"
  hiddenInSingle: true
  relative: false
---

这一版：`#标题` 不打空格也认了。

![弹窗](/post-images/nforce-todo-v2-11-1/01-popup.png "点工具栏图标就是它：一条顶栏、输入行、今天的清单，底部一行状态")

*点工具栏图标就是它：一条顶栏、输入行、今天的清单，底部一行状态。*

- 用户报的：写 `#定义 header` 解析不出来。另一半原因在还原现场 —— 中文写作里 `#` 后面经常不打空格（`#标题`），而 CommonMark 要求那个空格，于是整行落进段落，读者看到一个字面的 `#`。
- 单独一个 `#` 仍然不是标题（别造出空的一级标题）。
- 单测 399 → **401**，真机 341 → **342**。

## 另外两个面

![工作台 · 今天](/post-images/nforce-todo-v2-11-1/02-app-tasks.png "三列：导航 / 列表 / 详情。提醒条和输入行在最下面那一条横带上")

*三列：导航 / 列表 / 详情。提醒条和输入行在最下面那一条横带上。*

![工作台 · 笔记](/post-images/nforce-todo-v2-11-1/03-app-notes.png "左边写 Markdown，右边同时是它读起来的样子")

*左边写 Markdown，右边同时是它读起来的样子。*

下载：<https://github.com/iamnicwu/nForce-Todo/releases/tag/v2.11.1>（源码包与可加载的 zip）。
