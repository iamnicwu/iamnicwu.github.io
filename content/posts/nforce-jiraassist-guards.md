---
title: "一个显示名，就能在你的扩展里执行脚本"
slug: "nforce-jiraassist-guards"
date: 2026-11-23T00:10:00+08:00
lastmod: 2026-11-23T00:10:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "安全", "工程实践", "nForce"]
summary: "安全评审翻出三处：图表 tooltip 把 Jira 里的名字当 HTML 执行、消息通道只看消息类型不看发送者、附件链接不做主机校验就带上 token。三处都不是「写错了」，是「读起来完全正常」。"
showToc: true
---

这周给插件做了一次代码与架构评审，重点看三件事：扩展性、安全性、以及哪里其实在慢慢变烂。结论里最扎眼的一条是安全：

**一个同事把自己的 Jira 显示名改成一段 HTML，就能在这个扩展的页面里执行脚本。**

扩展页面能调 worker，worker 手里有 Jira 的 token。所以这不是「弹一个框」级别的玩笑。

三处问题，都是修起来不到十行、但读代码时看起来完全正常的那种。

## 一、tooltip 是 HTML，名字却没有转义

图表的 tooltip 长这样：

```js
formatter: (params) =>
  `${params.name}<br/><b>${params.value}</b> issues · ${params.percent}%`,
```

`params.name` 是 Jira 的字段值——负责人显示名、状态名、问题类型，或者从 CSV 导入的分类标签。这段字符串被 ECharts 当作 **HTML** 插进 tooltip。

判断渲染模式不用猜，看一行就够了：

```js
tooltip: {
  extraCssText: 'border-radius:10px;',   // 只有 html 模式认这个属性
}
```

也就是说，只要有人把显示名改成 `<img src=x onerror=...>`，那段脚本就会在扩展的页面里跑。而这个页面的 `chrome.runtime` 是完整的：它能调 `BULK_SET`、`CATEGORISE_APPLY`，也能让 worker 用它保存的凭据去改 Jira。

修法没有技巧，就是把名字当文本：

```js
import { escapeHtml } from './ui.js';

formatter: (params) =>
  `${escapeHtml(params.name)}<br/><b>${params.value}</b> issues · ${params.percent}%`,
```

一共六处：三张饼图、堆叠条的表头、趋势图的类别标签。`label.formatter` 没动——那是画布文字，不是 HTML，改了反而会显示成 `&lt;`。

**没有改成 `renderMode: 'richText'`**。那个模式确实不解析 HTML，但它同时丢掉 `extraCssText`，tooltip 会变回浏览器默认的方块。为了安全换掉整个视觉语言，不划算。

## 二、消息通道只看类型，不看是谁在问

worker 的路由原本是这样：

```js
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message?.type];
  ...
});
```

注意那个下划线：`_sender` 被丢掉了。四十多个消息类型，只按 `type` 分发。

扩展里唯一「不是自己页面」的发送者是内容脚本——它被注入到 Jira 页面里。也就是说，任何能在那个页面里执行代码的东西（一个 XSS、一个被篡改的第三方脚本），都可以对 worker 说：

```js
chrome.runtime.sendMessage({ type: 'CATEGORISE_APPLY', payload: { moves: [...] } })
```

然后 worker 就会拿着用户的 token 去写 Jira。绕过了前面那处修好的 XSS，等于白修。

补上的规则很短：

```js
const CONTENT_ALLOWED = new Set(['ATTACHMENT_MSG']);

function refusalFor(message, sender) {
  if (sender?.id && sender.id !== chrome.runtime.id) return 'this message came from another extension';
  if (!sender?.tab) return '';
  const url = String(sender.url || sender.tab?.url || '');
  if (url.startsWith(chrome.runtime.getURL(''))) return '';
  if (CONTENT_ALLOWED.has(String(message?.type || ''))) return '';
  return `${message?.type} is not available to a page script`;
}
```

**这里我第一版写错了，而且只有真浏览器能发现。**

第一版的判定是「有 tab 就等于内容脚本」。听起来合理——内容脚本确实活在 tab 里。但**扩展自己的页面也开在 tab 里**：设置页就是 `chrome.runtime.openOptionsPage()` 打开的。

结果：设置页一条消息都发不出去，页面上的站点 URL 是空的。

单元测试当时没抓到，因为我在测试里构造的「自己页面」发送者**没有 tab**——恰好绕过了这个 bug。抓它的是浏览器门禁的那条断言：

```
Verification failed: A fresh install should show the shipped site
"https://jira.bpuit.pccw.com:8443", got ""
```

一个「新装应该显示什么」的断言，抓到了一个权限模型的 bug。这就是为什么那个 5000 行的 `verify-ui.mjs` 一直没被删掉。

修法是看 URL 而不是看有没有 tab：`chrome.runtime.getURL('')` 是本扩展的 origin，来自它的页面放行，其余带 tab 的只给读附件。

## 三、附件链接不校验主机，就把 token 递出去

下载 `.msg` 附件的函数里，原本算了主机，但只算给错误提示用：

```js
let host = '';
try { host = new URL(attachment.url).origin; } catch { host = ''; }
// host 只出现在 hint 里，然后……
const result = await requestBytes(attachment.url, { settings });
```

`requestBytes` 会附上和所有请求一样的 `Authorization` 头。链接是 Jira 自己写的，正常情况没问题；但代码的实际含义是「把这个 token 发给任何传进来的 URL」。

Cloud 那条链路其实是安全的：附件在站点域名上，**重定向**到 `api.media.atlassian.com`，而浏览器跟随跨域重定向时会剥掉 `Authorization`。真正没有防护的是「链接一开始就指向别处」这一种。

于是加了一个纯函数，五行判断，可测：

```js
export function attachmentOriginAllowed(url, baseUrl) {
  // 同站点 origin：放行
  // *.atlassian.com / *.atlassian.net：放行（Cloud 的媒体域）
  // 其余：拒绝，并把主机名写进错误里
}
```

拒绝的文案里带主机名是有意的：`acme.atlassian.net.example.com` 这种仿冒域名要让人一眼看见，否则「附件下不下来」会把人引到权限设置上去查半天。

## 副产品：一条假断言

给第二处补测试时，我写了一个 async 用例，用的却是同步的 `test()`：

```js
test('the download function refuses before it sends a single byte', async () => { ... })
```

这个仓库的 runner 只在该 await 的地方 await——`test` 不等 promise，`asyncTest` 才等。所以那个用例**永远通过，哪怕守卫被删掉**。

发现它的是变异测试：故意删掉守卫，跑一遍套件，报「没有测试变红」。改成 `asyncTest` 之后，同样的变异立刻被抓住。

变异测试平时被吐槽「慢、贵、收益不明显」。它这一周唯一的功劳就是这句：**它抓的不是代码，是测试本身在骗人。**

## 结果

- **652 组断言**（新增 4 条守卫断言：三种图表各喂一个恶意名字、路由拒绝外来扩展与页面脚本、附件主机白名单、下载函数真的在发请求前拒绝）
- **287 个变异**全部命中预期断言（新增 3 条：去掉转义、去掉发送者校验、去掉主机校验）
- `check` / `build` / `verify`（真 Chrome，十个页面）全绿

## 为什么单独发一版

这三处都没有改变任何界面、任何功能。按「有没有新东西」的标准，它不该占一个版本号。

但它们改变的是**这个扩展可以被谁驱动**。安全修复和功能混在一个版本里，出事的时候没人分得清是哪一个引入的；单独一版、单独一个 tag，回滚就是把版本号退回去，不用在功能里挑。

顺带把评审里另外两条也落了地：README 补了一份「加一个页面要动哪九处」的清单（这次新页面就漏了两处，被测试抓回来），以及「两套 plan/apply 现在不抽，第三套出现时抽」的触发条件——写成文字，免得下次变成第三次复制。

版本 `v1.14.21`。
