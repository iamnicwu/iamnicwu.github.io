---
title: "nForce Translate v1.7.1：修掉主题被「保存」打回去的 bug"
slug: nforce-translate-v171
date: 2026-11-09T14:51:39+08:00
lastmod: 2026-11-09T14:51:39+08:00
draft: false
tags: ["Chrome 扩展", "翻译工具", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-translate"
version: "v1.7.1"
summary: "v1.7.0 的主题切换有个坑——选完深色，只要再点一次保存或「测试翻译」，主题就会自己跳回「跟随系统」。这一版修好了。"
showToc: true
---

v1.7.0 里的主题切换有个隐蔽的 bug：**点一下深色，界面确实是深色；但只要之后有任何一次设置被保存，主题就自己跳回「跟随系统」。**

最容易被撞上的就是「测试翻译」——它会先保存再发请求，所以很多人是在这一步发现主题被打回去的。除设置页之外，已经打开的弹窗、润色页、PDF 阅读页在设置变化时也会一起掉回跟随系统。

## 为什么会这样

所有页面靠 `chrome.storage.onChanged` 实时跟随主题。这里读错了数据形状：

- `chrome.storage.local.get('settings')` 返回的是**包装层** `{ settings: { theme } }`
- `onChanged` 给的 `newValue` 是**设置本体** `{ theme }`，没有外面那一层

同一段读取逻辑被这两种形状共用，于是 `newValue.settings.theme` 永远是 `undefined` —— 收敛成默认值「跟随系统」。看起来就像「保存一次，主题被重置一次」。

修法是把这条路径统一成只认设置本体，`get()` 的结果在入口处先解包。顺手补了三条回归断言：落盘后不回弹、写设置不重置主题、其它已打开页面跟着保持深色。之前那条断言是在 `change` 事件里**同步**读的，正好错过了几毫秒后的异步回退，所以一直没报警。

## 顺带说一句

主题是「选了就记住」的偏好，不该被保存其它设置顺带擦掉。以后凡是碰 `watchTheme` 的改动，都会先被这三条断言挡一次。
