# nForce Tools：把 Salesforce 的日常操作收进一个侧边栏

> Salesforce 的日常操作都收在一个侧边栏里：连组织、批量查单、拉报表、跑 Bulk API、看 Org 用量。数据从浏览器直接打到 Salesforce，中间不经过服务器。

做 Salesforce 相关的工作，很多时间花在重复动作上：把一批订单号拼进 SOQL 查一遍，导个报表看哪个订单卡住，翻 Data Loader 查一条记录。每件事都要开新标签、登录、拼查询。

nForce Tools 把这些事收到浏览器侧边栏里。数据从浏览器直接打到 Salesforce，中间不经过任何服务器。

这篇写的是 v4.4 时的样子。后来加的全局搜索、日志查看器、批量查询，单独记在[另一篇](https://blog.nickwu.fun/post/nforce-tools-v415/)。

![nForce Tools 的功能中心](https://blog.nickwu.fun/post-images/nforce-tools/01-home.png "首页是一个图标化的功能中心，按「连接与环境 / LTS / 数据分析 / OTT / PCD / CVP7 / 工具」分组。最近用得多功能会自动排到「常用功能」那一栏里去")

## 连接不用配 Connected App

扩展不要求在 Salesforce 里注册 Connected App、拿 Client ID 走 OAuth。那套流程对个人工具来说太重了。它走的是另一条路：

- 手动贴 Session ID。从开发者控制台或者浏览器里复制一串粘进去，点「保存 Session ID」再「测试连接」。
- 自动获取会话。浏览器里本来就在 Salesforce 登录着的话，扩展可以直接读 Cookie 换一个新会话，不用手动粘。

顶部一直挂着两枚状态：连上没连上，连的是 Production 还是 Sandbox。两个状态分开显示，发错环境的时候一眼能看出来。

![插件偏好面板](https://blog.nickwu.fun/post-images/nforce-tools/05-prefs.png)

*插件偏好里可以锁定 Salesforce API 版本（默认 64.0，可自定义），以及确认侧边栏当前在左边还是右边*

*对应关系里的第一件事是 API 版本。组织不支持某个版本时请求会返 404，这里能降级重试。*

### 会话过期了会自己救一次

Session ID 是短命的。隔一段时间不用，或者 Salesforce 那边主动失效，接口就开始返 401。同类工具一般是弹个报错，让你回去重新粘一次。一天碰上两回就挺烦。

这里的做法分两步：

1. 先自己救。检测到失效时，扩展会尝试从浏览器 Cookie 里重新换一个会话（`cookies` 权限）。换到了就静默继续。
2. 救不了才叫人。Cookie 那条路走不通（浏览器里没登录态，或者组织禁了 Cookie 取 token），就告诉你缺的是什么，并给一个「打开登录页」的按钮。登录完回来点一下「自动获取 Session 并重新连接」。

![会话重新连接面板](https://blog.nickwu.fun/post-images/nforce-tools/07-session-reconnect.png)

*自动修复失败时给的是具体原因，和一条能走的路*

MV3 的 Service Worker 空闲 30 秒就会被回收，所以启动时要补一次检查。不然重启浏览器之后，第一下操作必然撞在失效会话上。

## 功能地图

侧边栏按业务域分组，一共七组。下面是各组里主要做了什么。

### 连接与环境

| 功能 | 做什么 |
| --- | --- |
| 连接设置 | Session ID 录入、连接测试、当前用户与组织信息 |
| Session 管理 | 会话状态查看、自动重连、登录页快捷入口 |

### LTS

LTS（Long Term Sales）相关的订单查询是这个扩展最早做的一块，也是用得最多的。

| 功能 | 做什么 |
| --- | --- |
| LTS 概览 | Fallout Summary 的案例汇总与业务流程图 |
| 获取当日数据 | 一键拉当日 LTS 订单，自动去重后落到表格里 |
| 获取报表数据 | 快速取预定义报表，不用再去 Reports 里点开 |
| 获取文件数据 | 上传含订单号的 Excel，批量查最新状态与明细 |
| VVIP | 上传含 Account ID 的 Excel，同时查 PCD 与 LTS 订单并合并 |
| T-4 Outstanding | 取 T-4 报表并筛出符合规则的记录 |
| T-4 分析 | 在 T-4 结果上做规则分析 |

### 数据分析

上传一份 Excel，再（可选）传一份规则 JSON，扩展按规则逐行判断并写回状态列。业务规则变了改 JSON 就行，不用改代码重新发版。

### OTT / PCD / CVP7

| 分组 | 内容 |
| --- | --- |
| OTT | OTT 数据获取 |
| PCD | 当日 PCD 数据、PID Fallout 排查、QC Issue 排查 |
| CVP7 | T-4 连通性检测 |

### 工具

| 功能 | 做什么 |
| --- | --- |
| Bulk 操作 | 输入 SOQL，走 Salesforce Bulk API 2.0 建批任务，轮询进度，完成后下载结果 CSV。自动分页取全量，适合几十万行那种一次查询拉不完的量 |
| Execute Anonymous | 直接在扩展里提交 Apex 匿名代码块并看执行日志 |
| Schedule Jobs | 列出、创建、暂停、恢复、清除定时任务 |
| Debug Log 查看器 | 读 Apex Debug Log，省掉一层 Developer Console 的加载 |
| 中午食乜 | 上传餐厅列表 Excel，抽签决定今天中午吃什么 |

最后那个是真事，团队每天中午要纠结十分钟。

## 首页可以自己排

功能多起来之后，平铺一长条列表就很难找。所以首页做成了图标网格，并且可以改：

- 每个图标可以固定到「常用功能」，也可以隐藏。
- 「常用功能」会按实际使用频率自动排序，手动固定的排在自动排序前面。
- 布局配置页里能整组拖动、改名、调顺序。

![布局配置页](https://blog.nickwu.fun/post-images/nforce-tools/02-layout.png "分组顺序、组内图标、常用区都能改。改完直接反映到首页")

设置页只管三件事：连接、布局、项目说明。什么都往里塞，它就变成第二个首页了。

![设置页](https://blog.nickwu.fun/post-images/nforce-tools/03-settings.png)

## Org Limits 看板

排查问题时经常要确认：是逻辑写错了，还是这个组织的 API 配额打满了。Salesforce 把这个信息藏在 Setup 里，点进去要好几层。

侧边栏顶部直接放了一个仪表盘，用 ECharts 的 gauge 画的：

![Org Limits 仪表盘](https://blog.nickwu.fun/post-images/nforce-tools/06-org-limits.png)

*Daily API Requests、Daily Async Apex Executions、Daily Bulk API Requests、Data Storage 四项，超阈值会变红并汇总成顶部一条告警*

颜色按 60%、85% 两档阈值插值，越接近上限越偏红。右上角那个「1 项超额」会直接列出越线的项，不用自己一格一格比。

数据来源是 `/services/data/vXX.X/limits`，会话有效就能读。

## 安装

扩展没上架 Chrome 商店（内部工具，审核那套流程不划算），走开发者模式加载：

1. 去 [GitHub 仓库](https://github.com/iamnicwu/nForce-tools) 把代码拉下来。
2. 打开 `chrome://extensions/`，右上角打开开发者模式。
3. 点加载已解压的扩展程序，选仓库根目录。

想要打包产物就用 `dist/`：`npm install && npm run build`，然后把 `dist/` 加载进去。源码目录也可以直接加载，改完在扩展页点一下刷新就生效。改逻辑的时候，这个比重新构建快。

装好后点工具栏图标 → 「打开应用」，主界面会在新标签页里打开；点侧边栏图标则常驻在右侧。

## 几处技术选择

构建从 webpack 换成了 Vite，配置短了不少，构建从十几秒降到一两秒。

表格用 Handsontable，Excel 用 SheetJS。查询结果动辄几百上千行，排序、拖列宽、筛选、复制单元格这些自己拿原生 table 拼不划算。

所有请求都在 Service Worker 里发，页面脚本拿不到 Session ID。host 权限只开 Salesforce 这几个域名：

```
https://*.salesforce.com/*   https://*.force.com/*
https://*.salesforce-setup.com/*   https://*.visualforce.com/*
https://*.cloudforce.com/*   ...（含 .cn / .mil / .mcas.ms 等变体）
```

规则判定、日期解析、Excel 列名识别这些纯逻辑抽出来写了单测。UI 层没测，靠人看。

## 已知的限制

- 没上架商店，装的时候有「开发者模式」的心理成本，也没法用商店的自动更新。
- 会话依赖浏览器登录态。如果组织策略禁止用 Cookie 换 token，就只能手动贴 Session ID。
- 批量查询走的是实时 API，一次查太多会被 Salesforce 的并发与调用配额拦住。真要拉几十万行请走 Bulk 操作那个模块。
- 界面基本只做了桌面宽度。Salesforce 本身在手机上也不太好用，这块就没花力气。

## 小结

这东西没什么技术含量，主要是把「每次都要点五层菜单」变成「点一下」。真正耗时间的是搞清楚业务规则怎么判，再把规则做成可配置的 JSON。业务变了改配置，不用重新发版。

代码在 [github.com/iamnicwu/nForce-tools](https://github.com/iamnicwu/nForce-tools)，MIT 协议。有需要可以自己 fork 改。

---

**项目仓库**：https://github.com/iamnicwu/nForce-tools

---

原文：[nForce Tools：把 Salesforce 的日常操作收进一个侧边栏](https://blog.nickwu.fun/post/nforce-tools/) · v4.15.0
标签：Salesforce · Chrome 扩展 · 效率工具
站内还写过几款同系列扩展，感兴趣可以顺着标签翻一翻。

<!-- 发布提示：图片已换成绝对地址 https://blog.nickwu.fun/post-images/…，需要先确认站点已部署到 GitHub Pages，否则图片会 404。 -->
