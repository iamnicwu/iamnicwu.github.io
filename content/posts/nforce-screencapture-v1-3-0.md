---
title: "nForce Screen Capture v1.3.0：建立组件层，修一轮可读性"
slug: nforce-screencapture-v1-3-0
date: 2026-10-26T01:39:39+08:00
lastmod: 2026-10-26T01:39:39+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.3.0"
summary: "建立组件层，修一轮可读性。common/components.css：按钮 / 卡片 / 表单 / 下拉 / 键帽收成一份，六个页面不再各写一遍。此前 .btn 有五份实现，圆角 8/9/10px、字号 12/12.5/13px 互相打…"
showToc: true
---

这一版的主题是**建立组件层，修一轮可读性**。下面是要点，完整提交记录见 [Release v1.3.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.3.0)。

## 这一版改了什么

### 新功能

- **新增** `common/components.css`：按钮 / 卡片 / 表单 / 下拉 / 键帽收成一份，六个页面不再各写一遍。此前 `.btn` 有五份实现，圆角 8/9/10px、字号 12/12.5/13px 互相打架，改一次要改五处
- **新增** token 尺度：`--radius-sm/md/lg/xl`、`--text-xs…xl`、`--canvas-bg`、`--canvas-check`、`--chevron`，页面 CSS 里不再出现裸圆角与裸字号

### 修复

- **修复** 弹窗真实高度：默认 364px、带最近截图 419px、录制 + 3 行字幕 557px —— 全部落在 Chrome 600px 上限内。此前最坏 675px，状态栏被挤出可视区
- **修复** 可读性：弹窗功能文字 10.5px → 11.5px（快捷键改成键帽样式），设置页正文 11.5px → 12px，全站不再有低于 11.5px 的可见文字
- **修复** 下拉框补上箭头。`appearance:none` 之后一直没画，导致下拉和文本框视觉同构，用户不知道能展开
- **修复** 编辑器浅色主题下 hover 完全失效（白叠白，实测合成后仍是 #ffffff）、错误提示对比度 1.80:1 → 4.83:1、色板 22px → 24px
- **修复** 诊断页日志补表头（五列没有任何标题）、「清空」改为就地二次确认、复选框从浏览器默认蓝改成主题色

### 优化与其他

- **优化** 弹窗分两段：上段四个截图模式，下段并排「录制 / 识别文字」。快捷键只在真的绑定时显示 —— 原来固定渲染「未设置」，会被读成「这个功能不能用」
- **优化** 设置页分三组并加筛选：基础与截图 / 录制与字幕 / 集成与诊断，组头吸顶、每组可单独恢复默认、顶部可按字段名筛选
- **优化** 保存反馈改成右上角常驻胶囊。原来它在页面最底部（y≈2577），拨完开关根本看不到

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.3.0](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.3.0)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
