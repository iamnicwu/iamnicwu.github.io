---
title: "nForce Translate v1.6.0 更新"
slug: nforce-translate-v160
date: 2026-10-23T00:55:54+08:00
lastmod: 2026-10-23T00:55:54+08:00
draft: false
tags: ["Chrome 扩展", "翻译工具", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-translate"
version: "v1.6.0"
summary: "引擎选择改下拉框，划词/悬停气泡精简、子模块检查别依赖具体文件名，另有 5 项调整。"
showToc: true
---

引擎选择改下拉框，划词/悬停气泡精简、子模块检查别依赖具体文件名，另有 5 项调整。

## 新功能

- 引擎选择改下拉框，划词/悬停气泡精简

## 修复

- 子模块检查别依赖具体文件名
- 博客部署前必须递归拉子模块，并加构建守卫
- 401 时说清「重新生成令牌后要重新保存 secret」
- 令牌只有读权限时提前拦住并说清怎么改

## 文档

- 写清博客令牌怎么拿（网页路径）+ 令牌失效降级为警告

## 其它改动

- 发版成功后自动往博客发一篇更新

## 怎么升级

已装的在 `chrome://extensions` 点一下「重新加载」即可；新装去 [Releases](https://github.com/iamnicwu/nForce-translate/releases/tag/v1.6.0) 下载 zip，解压后加载 `dist/` 目录。

---

_这篇由发版流水线生成，改动条目取自本版合并的 PR 标题。_
