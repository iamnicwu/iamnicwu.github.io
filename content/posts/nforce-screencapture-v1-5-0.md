---
title: "nForce Screen Capture v1.5.0：录完自动出摘要与流程图；ASR 改成「只填 Key」"
slug: nforce-screencapture-v1-5-0
date: 2026-10-27T23:24:25+08:00
lastmod: 2026-10-27T23:24:25+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.5.0"
summary: "录完自动出摘要与流程图；ASR 改成「只填 Key」。摘要：录制结束打开回放页，右侧栏自动把字幕读一遍，给出 120 字以内的摘要 + 3-6 条要点"
showToc: true
---

这一版的主题是**录完自动出摘要与流程图；ASR 改成「只填 Key」**。下面是要点，完整提交记录见 [Release v1.5.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.5.0)。

## 这一版改了什么

### 新功能

- **新增 摘要**：录制结束打开回放页，右侧栏自动把字幕读一遍，给出 120 字以内的摘要 + 3-6 条要点
- **新增 流程图**：同一份结果里的步骤会画成纵向流程图（编号节点 + 箭头 + 一句说明），和视频同屏，不用切标签页
- **新增** 设置页「AI 摘要与流程图」卡片：预设 `DeepSeek / OpenAI / Groq / 自定义`，默认 **DeepSeek `deepseek-flash`**，填一个 Key 就能用；可关掉「录完自动生成」

### 修复

- **修正** ASR 与「摘要/流程图」是**两套配置**：前者要 `/audio/transcriptions`（DeepSeek 官方没有），后者走 `/chat/completions`（DeepSeek 正是这里最划算）。之前把 DeepSeek 设成 ASR 默认是错位的，现在各归其位

### 优化与其他

- **优化** ASR 预设改成「选服务只填 Key」：`Groq / OpenAI / 硅基流动 / 本地服务`，地址与模型名由预设带好，**默认 Groq `whisper-large-v3-turbo`**（有免费额度、延迟低）
- **实现** `lib/insight.js`（纯函数：字幕→提示词、模型输出→可渲染结构、流程图几何）与 `lib/llm-client.js`（chat + JSON 抽取 + 错误分类），回放页右侧栏按「无字幕 / 无 Key / 请求失败」三种状态分别给下一步

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.5.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.5.0)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
