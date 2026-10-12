# Nick's blog

Hugo + [PaperMod](https://github.com/adityatelange/hugo-PaperMod)，部署在 GitHub Pages，自定义域 **https://blog.nickwu.fun/**。

## 自定义域（blog.nickwu.fun）—— 改这里之前先读

**域名为什么是子域名而不是 apex：** 子域名走 CNAME，而按 RFC 8659，CAA 查询遇到 CNAME 要**跟着走到目标域**，
于是校验落在 `github.io`（GitHub 自家 DNS）上。apex 只能用 A 记录，CAA 只能直查 `nickwu.fun` 的权威 NS，
在阿里云那套 NS 上会**间歇性超时**（GitHub 的 `Dnsruby::ResolvTimeout`），
`is_https_eligible` 于是在 true/false 之间反复抖，**证书永远签不出来**。
换成子域名后闸门天生不抖 —— 这是 2026-10-12 折腾大半天的最终结论。

- `static/CNAME` 里写着 `blog.nickwu.fun`。**这个文件必须留在 `static/` 下**：
  Pages 的构建类型是 `legacy`（从 `master` 分支根目录发布），删掉 CNAME 文件等于取消自定义域。
  而 `scripts/deploy-via-api.mjs` 是「整棵新树覆盖 master」，所以 CNAME 只能由 Hugo 从 `static/` 带出来。
- `hugo.toml` 的 `baseURL` 必须与之一致，否则 canonical / sitemap / RSS / 列表封面图都会指回 `iamnicwu.github.io`。
- DNS：`blog` 用 CNAME 指向 `iamnicwu.github.io`（**不带仓库名**）。
  `nickwu.fun` 的 apex 已不再承载博客，A/AAAA 记录可以按需清理或另作他用。
- 更换或删除域名后，**当天就把 DNS 记录清掉**，避免域被他人接管（GitHub Pages 的 domain takeover 风险）。
- **顺序不能反：先改好 DNS，再设 Pages 自定义域。** 一旦设了自定义域，`iamnicwu.github.io` 会立刻 301 到新域名；
  这时如果新域名的 DNS 还没生效，站点会有一段时间完全打不开。
- 切域名后 HTTPS 证书要等 GitHub 自动签发（**GitHub Support 的说法是「触发重查后证书请求约需一小时」**，
  官方文档说最长 24h）。期间 `https://` 会回落到 GitHub 的兜底通配证书 `CN=*.github.io` —— 用
  `echo | openssl s_client -connect blog.nickwu.fun:443 -servername blog.nickwu.fun 2>&1 | openssl x509 -noout -subject`
  一眼就能判断是不是还没签发。证书就绪后再打开 **Enforce HTTPS**（`https_enforced` 在设置自定义域时会被重置为 false）。
  证书迟迟不来，先查两件事：**有没有多余的 A 记录**、**有没有 CAA 记录挡着 letsencrypt.org** —— 这两个都会让签发静默失败。
- **判断证书签不出来的第一步是 `GET /repos/iamnicwu/iamnicwu.github.io/pages/health`**
  （首次返回 `202` + 空 body，重试到 `200`）。看 `caa_error` 和 `is_https_eligible`：
  只要 `is_https_eligible` 是 `false`，证书就永远不会签发，不用干等。
- **不要用 Cloudflare 橙云代理绕过证书问题。** GitHub Support 明确警告：橙云会让 GitHub 看不到指向它的
  DNS 记录，**既阻碍签发、也会让已签发的证书无法自动续期**。要给 GitHub Pages 用 Cloudflare，必须灰云（DNS only）。
- 域名体检一条命令搞定：`node scripts/check-domain.mjs`（`baseURL` 从 `hugo.toml` 读，换域名不用改脚本）。
- DNS 记录的可导入版本在 [`dns/nickwu.fun.zone`](./dns/nickwu.fun.zone)；
  **该目录的 [`README.md`](./dns/README.md) 记录了 2026-10-12 的迁移过程**
  （阿里云云解析当时 zone 多版本不一致、AliDNS 间歇返回陈旧的 Vercel IP、GitHub 解析器查 CAA 超时）。

## 写新文章

在 `content/posts/` 下新建 Markdown 文件，文件头部：

```markdown
---
title: "文章标题"
slug: my-post            # 决定 URL：/post/my-post/
date: 2026-10-12
tags: ["标签1", "标签2"]
summary: "列表页与外部平台用的摘要，一句话说清这篇在讲什么。"
showToc: true
cover:
  image: "/post-images/my-post/01-hero.png"
  alt: "封面说明"
  hiddenInSingle: true   # 封面只出现在列表页，正文页不重复
  relative: false
---

正文用 Markdown 写...
```

- **`slug` 建议显式写**。`permalinks` 是 `/post/:slug/`，不写的话 Hugo 会用标题生成 slug，
  中文标题会变成一串拼音/转码，链接又长又难看。
- `draft: true` 的文章不会发布。
- 本地预览：`hugo server -D`，浏览器打开 http://localhost:1313
  （带 `-D` 才看得到草稿）
- 新建文件：`hugo new posts/我的文章.md`
- 构建与发布：`./deploy.sh`

## 配图

图片放在 `static/post-images/<slug>/` 下，正文里用**站内绝对路径**引用：

```markdown
![这是 alt](/post-images/my-post/01-hero.png "这是图注")
```

带 `"图注"` 的图片会由 `layouts/_markup/render-image.html` 渲染成 `<figure>` + `<figcaption>`；
不带图注就是普通 `<img>`。

两种需要特殊处理的情况（用原生 HTML 写，不要用 Markdown 语法）：

| 情况 | 写法 | 为什么 |
| --- | --- | --- |
| 图标类小图（256px 图标等） | `<figure class="post-figure is-icon">` | 否则会被拉成整栏宽 |
| 窄图（侧边栏截图，约 400px 宽） | `<figure class="post-figure is-narrow">` | 正文栏 720px，顺其放大 1.8 倍会明显发虚 |

封面另有两点经验：**列表缩略图会被裁成横幅**（`.post-figure` 那套不适用），所以封面尽量选宽图；
项目里只有方形图标时，用 `scripts/export-shares.mjs` 同目录的思路合成一张 16:9 的横幅再当封面。

## 站点结构

| 路径 | 内容 |
| --- | --- |
| `hugo.toml` | 站点配置：导航、taxonomy、PaperMod 参数、Fuse.js 检索参数 |
| `content/posts/` | 文章 |
| `content/about.md` | 「关于」页 |
| `content/projects.md` | 「项目」页，四张卡片是手写 HTML（`unsafe = true` 才能渲染） |
| `content/archives.md` / `search.md` / `tags/_index.md` | 归档 / 搜索 / 标签总览页 |
| `layouts/_markup/render-*.html` | 图片与链接的渲染钩子 |
| `assets/css/extended/custom.css` | 站点级样式补充（PaperMod 会自动拼到主题样式后面） |
| `static/post-images/` | 配图 |
| `shares/` | 对外平台的可粘贴版本，由脚本生成，**不要手工改** |
| `scripts/export-shares.mjs` | 生成 `shares/` |
| `dns/` | 域名解析记录（可导入的 zone 文件）与迁移说明 |

搜索走 PaperMod 的 Fuse.js 纯前端方案，靠 `[outputs] home` 里多输出的那个 `index.json`。
中文检索把 `params.fuseOpts.threshold` 放宽到 `0.4` 才有实用效果。

## 分享到其他平台

```bash
node scripts/export-shares.mjs
```

会把 `content/posts/*.md` 导出成 `shares/*.md`：去掉 front matter、图片换成绝对 URL、
`<figure>` 降级成纯 Markdown。各平台适配与发布前检查见 `shares/README.md`。

## 发布流程说明

- 源文件在 **`blog-source`** 分支（本分支），构建产物在 `master` 分支，GitHub Pages 从 `master` 读取
- 发布：`./deploy.sh` —— 构建 `public/`，clone 一份 `master`，rsync 覆盖后提交推送
- 主题 PaperMod 以 git submodule 形式存放在 `themes/PaperMod`
- 改完样式记得留意 `assets/css/extended/` 是否被 `resources/_gen` 缓存 —— 构建结果异常时
  先 `rm -rf resources/_gen` 再构建
- **如果 `deploy.sh` 卡在 `git clone`**：说明当前网络到 `github.com` 不通（走它的是 clone/push）。
  但 `api.github.com` 往往仍然可达，可改用 `node scripts/deploy-via-api.mjs "说明"` —— 它走
  GitHub 的 Git Data API 直接把整棵产物树提交到 `master`，不碰 `github.com`。

## 评论系统

Gitalk 因 clientSecret 必须暴露在前端已废弃。如需评论，推荐 [giscus](https://giscus.app/zh-CN)
（基于 GitHub Discussions，无需 secret）：在 giscus.app 生成配置后，在 `hugo.toml` 中设置
`params.comments = true` 并按 PaperMod 文档添加 giscus partial。
