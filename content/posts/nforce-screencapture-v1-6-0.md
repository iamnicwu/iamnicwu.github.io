---
title: "nForce Screen Capture v1.6.0：文字识别支持上传本地图片"
slug: nforce-screencapture-v1-6-0
date: 2026-11-09T10:59:33+08:00
lastmod: 2026-11-09T10:59:33+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.6.0"
summary: "文字识别支持上传本地图片。识别页可以直接吃本地图片，三条路都通：顶栏「打开图片」选文件、把图拖进页面、⌘/Ctrl+V 粘贴（截图工具的「复制图片」、网页右键「复制图像」都能粘）"
showToc: true
---

这一版的主题是**文字识别支持上传本地图片**。下面是要点，完整提交记录见 [Release v1.6.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.6.0)。

## 这一版改了什么

### 新功能

- **新增** 识别页可以直接吃本地图片，三条路都通：顶栏「打开图片」选文件、把图**拖进页面**、⌘/Ctrl+V **粘贴**（截图工具的「复制图片」、网页右键「复制图像」都能粘）
- **新增** 右键菜单「识别图片文件…」：手上有图片文件时不必先截屏，直接打开识别页的空态
- **新增** 空态页：没有截图 id 时不再报「缺少截图 id」，而是给出「拖入 / 粘贴 / 选择图片」三条路和格式说明

### 修复

- **修正** 识别页顶栏比其它工具页高 1px（语言下拉按内容算出 36px），并把顶栏下拉从 `width:100%` 收回按内容宽 —— 700px 窄窗口下按钮不再被挤到第二行

### 优化与其他

- **优化** 上传即自动识别（选图这个动作本身就代表「我要读这张」），结果照旧存进本地存档，能在弹窗「最近截图」里看到、也可以换语言重识别
- **优化** 大图先规整再入库：超过 3000px 或 6MB 的图会压一次 —— 照片转 JPEG，**线稿 / 截图反而保留 PNG**（实测 3200×200 的线稿 PNG 2.4KB，转 JPEG 要 16KB），压完更大就直接留原图，存档体积不会因为"压缩"变大
- **优化** 空态时「重新识别 / 复制 / 下载」真的禁用（以前可点但点了只报"还没有文字"）

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.6.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.6.0)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
