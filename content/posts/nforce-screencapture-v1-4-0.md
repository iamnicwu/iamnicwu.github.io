---
title: "nForce Screen Capture v1.4.0：AI 字幕默认切到 DeepSeek / deepseek-flash"
slug: nforce-screencapture-v1-4-0
date: 2026-10-27T01:05:57+08:00
lastmod: 2026-10-27T01:05:57+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.4.0"
summary: "AI 字幕默认切到 DeepSeek / deepseek-flash。设置页「服务预设」一排胶囊：DeepSeek / OpenAI / Groq / 硅基流动 / 本地服务。点一下同时填好接口地址与模型名，之后仍可手改；当前匹配的预…"
showToc: true
---

这一版的主题是**AI 字幕默认切到 DeepSeek / deepseek-flash**。下面是要点，完整提交记录见 [Release v1.4.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.4.0)。

## 这一版改了什么

### 新功能

- **新增** 设置页「服务预设」一排胶囊：`DeepSeek / OpenAI / Groq / 硅基流动 / 本地服务`。点一下**同时**填好接口地址与模型名，之后仍可手改；当前匹配的预设会高亮

### 修复

- **修复** 「把这个地址当转写用」的失败被说清楚了：官方 DeepSeek 只有 `/chat/completions`，没有 `/audio/transcriptions`。现在
  - 地址填 `api.deepseek.com` 时，设置页直接显示橙色提示（见附图）
  - 「测试连接」遇到 404/405 会输出「该地址没有 /audio/transcriptions …」并给出换哪个预设
  - 录制中转写失败也走同一套文案，不再是干巴巴的 `HTTP 404`
- **修复** 模型名兜底两处仍是 `whisper-1`（SW 与测试连接），已同步为 `deepseek-flash`

### 优化与其他

- **变更** 默认服务改成 **DeepSeek**，默认模型名 **`deepseek-flash`**（此前是 OpenAI + `whisper-1`）。只影响新装/未改过该设置的用户，已保存的配置不会被覆盖

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.4.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.4.0)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
