---
title: "nForce Screen Capture v1.4.1：修弹窗底部两张卡「比上面大一圈」"
slug: nforce-screencapture-v1-4-1
date: 2026-10-27T01:09:53+08:00
lastmod: 2026-10-27T01:09:53+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.4.1"
summary: "修弹窗底部两张卡「比上面大一圈」。「录制屏幕 / 识别文字」两张卡比上面四张明显宽一圈：.modes/.actions 用的是 1fr 1fr，"
showToc: true
---

这一版的主题是**修弹窗底部两张卡「比上面大一圈」**。下面是要点，完整提交记录见 [Release v1.4.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.4.1)。

## 这一版改了什么

### 修复

- **修复** 「录制屏幕 / 识别文字」两张卡比上面四张明显宽一圈：`.modes`/`.actions` 用的是 `1fr 1fr`，
  而 `1fr` 的最小尺寸是 `auto`，卡片内容（标题 + 键帽）撑破轨道时会溢出右侧 14px 内边距。
  改成 `repeat(2, minmax(0, 1fr))` 后，六张卡左右边缘严格对齐

### 优化与其他

- **优化** 卡片变窄后两条提示被省略号截断，各缩短两字：`Demo 视频 · 带声音`、`框选读字 · 可复制`

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.4.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.4.1)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
