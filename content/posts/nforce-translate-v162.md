---
title: "nForce Translate v1.6.2：润色默认模型换成 deepseek-flash"
slug: nforce-translate-v162
date: 2026-10-26T00:39:08+08:00
lastmod: 2026-10-26T00:39:08+08:00
draft: false
tags: ["Chrome 扩展", "翻译工具", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-translate"
version: "v1.6.2"
summary: "润色模型的默认值从 deepseek-chat 改为 deepseek-flash；翻译那边的默认值不变，两边继续各管各的。"
showToc: true
---

润色是短文本任务，默认用更轻的一档模型更合适，所以把「设置 → 润色模型」里模型名称的默认值从
`deepseek-chat` 改成了 `deepseek-flash`。

两件事需要说清楚：

- **只影响默认值。** 你之前手填过的模型名不会被覆盖 —— 已经填了 `deepseek-chat` 的继续用它，
  升级后行为不变。
- **翻译那边没动。** 翻译选「AI 模型」时默认仍是 `deepseek-chat`，两块配置照旧互相独立。

想改回来也简单：设置里把模型名称改回 `deepseek-chat` 保存就行。
