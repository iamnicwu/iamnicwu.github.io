---
title: "nForce Screen Capture v1.6.2：弹窗可以直接进入识别页"
slug: nforce-screencapture-v1-6-2
date: 2026-11-09T11:39:23+08:00
lastmod: 2026-11-09T11:39:23+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.6.2"
summary: "弹窗可以直接进入识别页。弹窗在两张动作卡下面多一条 「上传图片识别」：整宽 34px、右侧箭头表示跳转，点击直接打开识别页的上传区，弹窗随之关闭"
showToc: true
---

这一版的主题是**弹窗可以直接进入识别页**。下面是要点，完整提交记录见 [Release v1.6.2](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.6.2)。

## 这一版改了什么

### 新功能

- **新增** 弹窗在两张动作卡下面多一条 **「上传图片识别」**：整宽 34px、右侧箭头表示跳转，点击直接打开识别页的上传区，弹窗随之关闭

### 优化与其他

- **优化** 「识别文字」卡的文案改回 **「框选一块区域」**——两个入口语义分开：卡片 = 框选屏幕，横条 = 手上有图片文件
- **优化** 录制中自动收起这条入口：录制时不该被「去另一个页面」打断，顺带把 42px 让给 AI 字幕面板
- **高度** 弹窗 317 → **359px**（远低于 600px 上限），录制中退回 317px

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.6.2](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.6.2)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
