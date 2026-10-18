# iamnicwu.github.io 项目约定

## 这是什么

个人博客。**Hugo + PaperMod**，部署在 GitHub Pages，线上 **https://blog.nickwu.fun/**（已开强制 HTTPS，Let's Encrypt 证书 90 天自动续期）。

GitHub Pages 的构建类型是 **legacy**：直接从 `master` 分支根目录发布，**Pages 不做构建**。

> 历史：2026-10 之前是 Gridea 生成。中间短暂考虑过「自维护的静态站生成器」（会有 `build.mjs`、
> `src/templates.mjs`、`package.json`），**该方案已放弃、仓库里没有这些文件** —— 若在别处看到
> 相关描述，是过期资料。现在是 Hugo。

## 铁律

- **Markdown 是源**：文章只在 `content/posts/*.md` 里改。`public/`、以及发布到 `master` 的
  `index.html` / `post/**/` / `archives/` / `tags/` 等全是构建产物，手改会被下次构建覆盖。
- **必须本机构建再部署**：GitHub Pages 不会替你跑 Hugo。
- **`static/CNAME` 必须留在 `static/` 下**（内容 `blog.nickwu.fun`）。legacy 模式下删掉这个文件
  等于取消自定义域；它和 Pages 配置里的自定义域是**同一件事的两面**，不能只改一边。
- **`hugo.toml` 的 `baseURL` 必须与 `static/CNAME` 一致**，否则 canonical / sitemap / RSS /
  列表封面图都会指回 `iamnicwu.github.io`。
- **apex `nickwu.fun` 与 `www.nickwu.fun` 是刻意不解析的**（主域已腾空）。别把它当故障去修，
  `scripts/check-domain.mjs` 也按「空＝预期」判。
- 文章 `cover`（列表卡片/OG 用）不要和正文第一张图用同一张 —— 文章页不显示 cover，重复了像漏改。
- 构建/部署用 node 时加 `env -u NODE_OPTIONS`（WorkBuddy 注入的 fs shim 会捣乱）。

## 命令

```
hugo --minify --cleanDestinationDir       # 生成全站到 public/
node scripts/deploy-via-api.mjs "说明"    # 走 GitHub Git Data API 部署（github.com 被墙时用）
node scripts/check-domain.mjs             # 域名体检：解析、权威后端、CAA、Pages 闸门、证书、跳转
node scripts/verify-live.mjs              # 线上全站体检：BFS 爬站内链接逐个查状态码
node scripts/export-shares.mjs            # 导出外平台版本到 shares/
```

- 源文件推 `blog-source` 分支；`master` 是构建产物。
- `github.com` 走不通时用 `deploy-via-api.mjs`（Git Data API），别用 `git push`。

## 目录速查

| 路径 | 作用 |
| --- | --- |
| `content/posts/` | 文章源（front matter + 正文） |
| `content/about.md` / `projects.md` / `archives.md` / `search.md` / `tags/_index.md` | 各页 |
| `static/post-images/<slug>/` | 文章配图，正文用站内绝对路径 `/post-images/…` 引用 |
| `static/CNAME` | 自定义域，见上 |
| `layouts/_markup/render-*.html` | 图片与链接的渲染钩子 |
| `assets/css/extended/custom.css` | 站点级样式补充（PaperMod 自动拼到主题样式后） |
| `shares/` | 脚本生成，不要手改 |
| `dns/` | DNS 记录（可导入的 zone）与《域名与 DNS 说明》—— **动 DNS 之前先读它** |

## 域名与 HTTPS（2026-10-12 定型）

- **用子域名而不是 apex 是刻意的**：子域名走 CNAME，按 RFC 8659 的 CAA 校验会跟着 CNAME 走到
  `github.io`（GitHub 自家 DNS，**永不超时**）；apex 没有 CNAME 可跟，CAA 只能直查阿里云的权威 NS，
  那条路会间歇超时（`Dnsruby::ResolvTimeout`），`is_https_eligible` 反复抖，**证书永远签不出来**。
- **证书卡住时的处置**（闸门 `is_https_eligible` 稳定为 true、但 `https_certificate` 迟迟为 null）：
  ① 先用 [letsdebug.net](https://letsdebug.net/) 复核 —— 判定 `All OK` 就说明 DNS/DNSSEC/CAA/HTTP-01
  全没问题，是 GitHub 侧没排队；
  ② `PUT /pages {"cname":null}` → 等 10 分钟 → 重设 cname，重启签发。
  **实测重加后 2 分钟出证书**。细节与三个反直觉的坑见 `dns/README.md`。
- 站内搜索是 PaperMod 的 Fuse.js 纯前端方案，靠 `[outputs] home` 里多输出的那个 `index.json`；
  中文检索把 `params.fuseOpts.threshold` 放宽到 `0.4` 才有实用效果。
- 中文标签页 URL 仍是百分号编码（没做 slug 映射）。`favicon.ico` 目前还是 PMI-PBA 认证徽章。
