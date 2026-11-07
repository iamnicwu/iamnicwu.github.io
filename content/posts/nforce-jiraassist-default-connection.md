---
title: "nForce-JiraAssist：把默认连接指向团队自己的 Jira"
slug: nforce-jiraassist-default-connection
date: 2026-11-07T20:50:00+08:00
lastmod: 2026-11-07
draft: false
tags: ["Jira", "Chrome 扩展", "效率工具"]
summary: "设置页第一屏不再是一片空白：站点、部署类型和认证方式都按团队的实际环境预填好，而且是唯一不落任何凭据的组合——浏览器会话。"
showToc: true
---

每个工具的第一次打开，都是一次考试。Jira 周报这个扩展之前的第一屏考的是「你会不会填对的地址」——空输入框，占位符写着 `https://your-org.atlassian.net`。而团队真实的地址是 `jira.bpuit.pccw.com:8443`，手输它最常见的三种错法，长出来都一模一样：**丢了 8443 端口**（443 上确实也有个服务在应答）、**多带一个 `/jira` 路径**、**写成 `http://`**。三者从扩展这边看是同一种症状——连不上，而且不知道错在哪。

## 三个默认值是一件事，不是三件

```js
// lib/config.js
export const DEFAULT_BASE_URL = 'https://jira.bpuit.pccw.com:8443';

export const DEFAULT_SETTINGS = {
  baseUrl: DEFAULT_BASE_URL,
  source: DATA_SOURCE.SERVER,      // Server / Data Center
  authScheme: AUTH_SCHEME.SESSION, // 浏览器已有的登录态
};
```

写全 `https://` 是有意的：这个值就是字段里显示的东西，而在一个 SSO 后面的 Server 站点上，协议头和主机名一样属于「站点」本身。归一化（`resolveBaseUrl`）仍然管人工输入，只是对这个值没什么可判的。

`session` 更有意思，它是三种认证里唯一**不存任何凭据**的：请求不带 `Authorization`，靠 Chrome 自动附上你已经登录 Jira 的那张 cookie。代价也在这——你一登出它就不能用了。所以它从来不是「部署类型推导出来的默认值」：

```js
defaultAuthScheme(SERVER) // => 'bearer'，不是 'session'
```

这条规则我故意没有改。因为一旦让「Server」推出「session」，用户把部署按钮点到 Cloud 再点回来，扩展就会替他重新选中一个需要当前登录态才有效的方案——而那已经不是他做的选择了。

## 已保存的配置一个字都不动

默认值只对**全新安装**（或 storage 里没有 `baseUrl` 的情况）生效：`normalizeSettings` 是把默认值垫在存储值下面，`.env` 又优先于两者。所以老安装仍然指着它原来那个地址。

我没有写迁移。静默把别人的报表指向另一个 Jira，比「他多点一次」糟糕得多——那是一整周的数字悄悄换了来源，而屏幕上不会有任何提示。

## 首跑提示也跟着改了

原来那句提示的触发条件是 `!settings.baseUrl`：

```js
if (!state.settings.baseUrl) { showConnStatus({ title: 'Welcome', … }) }
```

默认值一填上，这个条件就永远为假——页面从此不再欢迎任何人。改成「还没有同步记录」，文案也从「填地址」换成了**「证明登录态」**：

> The site, the deployment and the credential are filled in for a Server / DC install reached with this browser's session. Press Test connection to prove the sign-in works, then Save settings.

因为默认值能替他填字段，不能替他确认「这个浏览器现在是不是登着的」。

## 怎么验证的

真 Chrome 里跑 `npm run verify:env`，断言的是**渲染结果**而不是配置对象：站点字段等于 `https://jira.bpuit.pccw.com:8443`、Deployment 选中 `server`、认证选中 `session`、token 输入框根本不向用户索取。顺带一条变异测试守着「默认站点丢端口」这个最容易犯的错——把 `:8443` 删掉，测试必须红。
