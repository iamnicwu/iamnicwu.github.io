---
title: "nForce Screen Capture v1.3.1：落 DESIGN.md，并按文档清掉样式漂移"
slug: nforce-screencapture-v1-3-1
date: 2026-10-27T00:34:44+08:00
lastmod: 2026-10-27T00:34:44+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.3.1"
summary: "落 DESIGN.md，并按文档清掉样式漂移。DESIGN.md：按 impeccable 的 DESIGN.md 规范写成（YAML token 层 + 八节正文），设计主轴定为「取景器」，强调色命名「取景蓝」、中性色「石墨灰」，组件…"
showToc: true
---

这一版的主题是**落 DESIGN.md，并按文档清掉样式漂移**。下面是要点，完整提交记录见 [Release v1.3.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.3.1)。

## 这一版改了什么

### 新功能

- **新增** `DESIGN.md`：按 impeccable 的 DESIGN.md 规范写成（YAML token 层 + 八节正文），设计主轴定为「取景器」，强调色命名「取景蓝」、中性色「石墨灰」，组件手感定为「精确而克制」
- **新增** `.impeccable/design.json` 边车：色阶、阴影、动效、断点与 9 个组件的可直接渲染片段（供设计面板/校验器使用）
- **新增** 文档级硬规则：11.5px 字号下限、No Side-Tab、Two-Role 色、600 高度上限；并把「视频画面字幕按视频高度换算」记为例外，免得下次被当成违规改掉

### 修复

- **修复** 字号漂移 6 处：弹窗 10.5 / 11 / 12.5px → 11.5 / 13，设置页分段控件 12.5 → 12，OCR 编辑区 13.5 → 14，诊断页 12.5 → 13
- **修复** 圆角漂移 5 处：logo 7px、缩略图 6px、预览图 6px、字幕框 6px、缩放标签 7px → 统一 8px（`--radius-sm`）

### 优化与其他

- **优化** 弹窗里的 `.status` / `.flex` 不再与 `components.css` 各写一份

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.3.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.3.1)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
