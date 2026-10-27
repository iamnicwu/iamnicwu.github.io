---
title: "nForce Screen Capture v1.5.1：流程图改用 archify 的视觉语言"
slug: nforce-screencapture-v1-5-1
date: 2026-10-27T23:44:30+08:00
lastmod: 2026-10-27T23:44:30+08:00
draft: false
tags: ["Chrome 扩展", "截屏录屏", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-screenCapture"
version: "v1.5.1"
summary: "流程图改用 archify 的视觉语言。流程图不再是「编号 + 直角箭头」的临时样式，按 archify 的 workflow 形态重画："
showToc: true
---

这一版的主题是**流程图改用 archify 的视觉语言**。下面是要点，完整提交记录见 [Release v1.5.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.5.1)。

## 这一版改了什么

### 优化与其他

- **优化** 流程图不再是「编号 + 直角箭头」的临时样式，按 archify 的 workflow 形态重画：
  - **分类色**：起点（取景蓝）/ 中间步骤（中性）/ 结果（信号绿），每类都是「同色描边 + 10~16% 同色填充」，而不是给每个节点随机取色
  - **正交走线** + `stroke-linejoin: round`：折角是小圆角，跨级连线绕左侧走，不压节点
  - 节点左侧编号圆点（白字）、底部一行图例（起点 / 步骤 / 结果）
- **技术说明**：archify 本体是 Node CLI（渲染器依赖 `node:path`、`fs`，1.6 MB shared 代码），Chrome 扩展运行时无法调用。
  所以这里对齐的是它的**视觉规范**，不是进程内调用；需要一张可分享的正式图时，仍可用 archify CLI 重新出图。

## 升级方式

在 `chrome://extensions` 打开开发者模式，把仓库里的 `dist/` 目录（或 Release 里的 zip 解压后）用「加载已解压的扩展程序」指向它即可。
扩展的设置与本地截图存档都保存在浏览器里，覆盖升级不会丢。

## 相关链接

- [源码仓库](https://github.com/iamnicwu/nForce-screenCapture)
- [Release v1.5.1](https://github.com/iamnicwu/nForce-screenCapture/releases/tag/v1.5.1)
- [问题反馈](https://github.com/iamnicwu/nForce-screenCapture/issues)
