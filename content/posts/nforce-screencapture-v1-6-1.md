---
title: "nForce Screen Capture v1.6.1：上传图片变成一块真正的区域"
slug: nforce-screencapture-v1-6-1
date: 2026-11-09T11:23:19+08:00
lastmod: 2026-11-09T11:23:19+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.6.1"
summary: "上传图片变成一块真正的区域。有图之后左栏底部常驻一条工具条：换一张 + 「拖入图片或按 ⌘V 可替换」—— 换图入口不再只在空态里出现"
showToc: true
---

这一版的主题是**上传图片变成一块真正的区域**。下面是要点，完整提交记录见 [Release v1.6.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.6.1)。

## 这一版改了什么

### 新功能

- **新增** 有图之后左栏底部常驻一条工具条：**换一张** + 「拖入图片或按 ⌘V 可替换」—— 换图入口不再只在空态里出现
- **新增 6 项交互断言**：点空白处触发选文件、点内部按钮只触发一次、`Enter` / `Space` 可用、焦点环可见、上传区尺寸 ≥300×200、cursor 为 pointer

### 优化与其他

- **优化** 上传不再是「空态里藏一个按钮」：识别页左栏整块就是**上传区**，占满栏宽、点击任意位置即选文件，图标/标题/说明/按钮/格式说明一次讲清三条给图路径
- **优化** 上传区可键盘操作：Tab 聚焦后 `Enter` / `Space` 打开文件框，焦点环 2px；`role="button"` + `aria-label` 说明完整用法
- **优化** 修饰键按平台显示：macOS 是 `⌘V`，Windows / Linux 是 `Ctrl+V`（之前写死 ⌘，非 Mac 用户会困惑）
- **优化** 顶部去掉重复的「打开图片」按钮：入口收敛到上传区，顶栏回到「语言 / 重新识别 / 复制 / 下载」四件套

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.6.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.6.1)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
