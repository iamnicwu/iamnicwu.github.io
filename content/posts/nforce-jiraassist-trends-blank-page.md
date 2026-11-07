---
title: "一个没闭合的注释，让整页死在第一行"
slug: nforce-jiraassist-trends-blank-page
date: 2026-11-07T21:00:00+08:00
lastmod: 2026-11-07
draft: false
tags: ["Chrome 扩展", "工程实践", "调试"]
summary: "发布出去的扩展里，Trends 页一打开就 ReferenceError：文件头的 docblock 少写了一个 */，整个 import 块被注释吃掉。构建是绿的，产物 26KB 看着很正常，只有真打开那个页面才会死。"
showToc: true
---

这是本周最值得写下来的一次故障：**页面从第一行就死了，而所有自动化都是绿的。**

## 症状

Trends 页打开一片空白，控制台一句话：

```
ReferenceError: createLogger is not defined
    at assets/trends-BP3_FMxZ.js:1:38
```

## 根因

`pages/trends.js` 开头的文档注释只写了 `/**`，忘了闭合：

```js
/**
 * Trends page controller.
 * …
 * layout.            <-- 这里本该有一行 */

import { … } from '../lib/ui.js';        // 全被注释吃掉
import { announce, createLogger } from '../lib/logger.js';
…

const log = createLogger('trends');       // 从这一行才回到真正的代码
```

下一个 `*/` 出现在第 41 行——于是第 9 行到第 41 行的**整个 import 块**都成了注释的一部分。第 42 行 `createLogger('trends')` 是文件里第一句真代码，而 `createLogger` 从来没有被声明。

## 为什么一路绿灯

这是最值得复盘的部分，三道关卡都没有拦住它：

1. **文件能解析**。注释没闭合不构成语法错误，JS 里它是合法的。
2. **构建是绿的**。Vite/Rolldown 打出来的 chunk 只有 26KB，头部是 `import"./tailwind-….js";var e=createLogger("trends")`——那次 import 是 modulepreload polyfill，剩下的名字全是自由变量。构建只保证「能打包」，不保证「能运行」。
3. **浏览器验证没看这一页**。它还在驱动重设计之前的 dashboard，而面板早就搬到了 Trends；更糟的是那套验证自己已经因为别的原因红了半年，没人再跑它。

我一开始还怀疑是打包器的多入口 bug，花了不少时间在 `manualChunks`、`treeshake: false`、`modulePreload: false` 上折腾。真正的线索其实一直在眼前：**未压缩的产物里保留着源码自己的 `import … from '../lib/ui.js'`**——那不是打包失败后的残留，那就是被注释掉的源码文本。

## 修的三件事，顺序比内容重要

**一、补上 `*/`**，让 import 回到代码里。

**二、把验证指向它本来该验证的页面**，并加一道最便宜的门禁：**八个页面逐个冷启动**。每页在全新 profile 里打开一次，任何 `exceptionThrown`、`console.error`、没挂上侧栏、正文短到不合理，都算失败。

```js
for (const [page, label] of PAGES) {
  const tab = await attachPage(ext('pages', page), { waitMs: 1800 });
  if (tab.errors.length) throw new Error(`${page}.html (${label}) threw on load: …`);
  if (seen.text < 80) throw new Error(`${page}.html rendered nothing — the script did not run`);
}
```

这条检查的成本是几秒，抓的恰恰是「所有自动化都绿、用户一打开就白屏」这一类。

**三、构建里补一条扫描**：产物 chunk 里如果还出现 `../lib/…` 这样的源码相对路径，说明有东西没被打包，构建直接红。注释里我写清了它的边界——**它抓不到这次的 bug**：一个 import 全被注释掉的模块，打出来的 chunk 里根本没有 import 说明符，只有真实打开页面才看得见。检查要写清自己抓不到什么，否则下一个人会以为有它就不用跑浏览器了。

## 一句话

> 构建绿只证明它能打包，不证明它能打开。

从那以后，发布门禁里 `npm run verify` 是必跑项，而不再是「本地可选」。
