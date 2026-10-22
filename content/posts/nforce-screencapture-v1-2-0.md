---
title: "nForce Screen Capture v1.2.0：发版后自动写一篇博客"
slug: nforce-screencapture-v1-2-0
date: 2026-10-23T00:36:42+08:00
lastmod: 2026-10-23T00:36:42+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.2.0"
summary: "发版后自动写一篇博客。自动发博客文章：Release 创建后，Actions 会用这一版的信息生成一篇 Hugo 文章，提交到 iamnicwu.github.io 的 blog-source 分支"
showToc: true
---

这一版的主题是**发版后自动写一篇博客**。下面是要点，完整提交记录见 [Release v1.2.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.2.0)。

## 这一版改了什么

### 新功能

- **新增** 自动发博客文章：Release 创建后，Actions 会用这一版的信息生成一篇 Hugo 文章，提交到 `iamnicwu.github.io` 的 `blog-source` 分支
- **新增** 博客自动构建部署：推 `blog-source` 即构建并发布到 `master`（原先要在本地跑 `deploy.sh`）

### 优化与其他

- **优化** 文章内容不再手写：标题与要点直接取自 `manifest.json` 的版本号和这里这段变更记录，改代码时顺手写完，发版即生成
- **优化** 项目页版本徽章自动同步：`content/projects.md` 里 Screen Capture 卡片的 `vX.Y.Z` 会跟着发版更新

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.2.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.2.0)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
