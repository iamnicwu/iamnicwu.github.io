---
title: "nForce Screen Capture v1.3.2：修弹窗卡片的对齐问题"
slug: nforce-screencapture-v1-3-2
date: 2026-10-27T00:48:07+08:00
lastmod: 2026-10-27T00:48:07+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.3.2"
summary: "修弹窗卡片的对齐问题。DESIGN.md 增补 The One Slot Rule：同一类信息在同类卡片里只能有一个位置"
showToc: true
---

这一版的主题是**修弹窗卡片的对齐问题**。下面是要点，完整提交记录见 [Release v1.3.2](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.3.2)。

## 这一版改了什么

### 新功能

- **新增** `DESIGN.md` 增补 **The One Slot Rule**：同一类信息在同类卡片里只能有一个位置

### 修复

- **修复** 快捷键键帽的位置不一致：原先四个截图模式的键帽在卡片**底部独立一行**，而「录制屏幕 / 识别文字」在标题旁边。一旦某个模式没绑快捷键（默认的「框选区域」就没绑），那张卡就少一整行，等高拉伸后下半截空着——看起来就是「对不齐」。现在六个入口统一：**键帽永远跟在标题后面**，未绑定就不渲染、不占位
- **修复** 卡片内部 1px 高度差：键帽固定 20px 高、标题行 `min-height: 20px`，有/无键帽的卡片内部高度严格一致
- **修复** 图标尺寸不统一：「录制 / 识别」用 18px，四个模式卡用 20px，现在统一 20px（1.8px 描边）

### 优化与其他

- **优化** 弹窗随之变矮：默认 364 → **317px**，带最近截图 419 → **373px**，录制+3 行字幕 557 → **510px**

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.3.2](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.3.2)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
