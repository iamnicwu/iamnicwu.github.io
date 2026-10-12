# 域名与 DNS 说明

## 最终方案

2026-10-12 定下的形态。**用子域名而不是 apex 是刻意的，不是将就。**

| | |
| --- | --- |
| 博客地址 | `https://blog.nickwu.fun/` |
| 承载记录 | `blog` CNAME → `iamnicwu.github.io`（**不带仓库名**） |
| apex `nickwu.fun` | **刻意不解析**，整个腾出来备用 |
| `www.nickwu.fun` | 同样不解析 |
| CAA | 无（刻意不加，见下） |
| DNS 托管 | 阿里云云解析（`dns25/dns26.hichina.com`） |

只有一条记录在干活。apex 和 www 都留空 —— 访客打主域会看到浏览器的 DNS 错误页，
而不是 GitHub 那个半死不活的 404。将来给 LobeChat、别的项目、或 apex 邮箱用都不受影响。

### 为什么必须是子域名

子域名走 **CNAME**，而按 RFC 8659，**CAA 查询遇到 CNAME 要跟着走到目标域** ——
于是校验落在 `iamnicwu.github.io` → `github.io`（GitHub 自家 DNS）上，**永远不会超时**。

apex 只能走 A 记录，CAA 必须直查 `nickwu.fun` 的权威 NS（阿里云 `dns25/dns26.hichina.com`），
**无记录时还要向上递归到 `.fun` 顶级域并做 DNSSEC「无 DS」证明**。这条路在 GitHub 的解析器
（Ruby 的 Dnsruby）上会**间歇性超时**：

```
apex nickwu.fun:  caa_error = "Dnsruby::ResolvTimeout"   is_https_eligible 在 true/false 之间反复抖
```

`is_https_eligible` 就是证书签发的闸门 —— 它抖，证书就**永远签不出来**。
实测 `www` 的闸门**一次都没关过**，apex 则几分钟一跳。这就是换子域名的全部理由。

### 为什么把 CAA 拿掉

那条 `CAA @ 0 issue "letsencrypt.org"` 是排查期间加的，**它没解决问题** ——
病根是 GitHub 解析器查 apex 的 CAA 时超时，加了记录照样超时。

现在也不该留，因为 **CAA 会按域树向上继承**：将来 `nickwu.fun` 底下任何新子域名
（比如做 A 记录的 `lobe.nickwu.fun`）签证书时，都会被这条限制成「只准 Let's Encrypt 签」。
Vercel、Cloudflare 之类可能用别的 CA（Google Trust Services、ZeroSSL…），届时会出现
**「证书签不出来但翻遍日志找不到原因」** —— 最难查的一类故障。
真要加，先查清目标服务用哪家 CA，再写对应的 issue 值。

> 顺带说明：`blog.nickwu.fun` 的证书签发**不受这里影响**。它的 CAA 校验会跟着
> CNAME 走到 `github.io`，`nickwu.fun` 上的 CAA 有没有、写了什么，都问不到它头上。

## 记录清单

见同目录的 [`nickwu.fun.zone`](./nickwu.fun.zone)（BIND 格式，含每条记录的来龙去脉）。

在阿里云云解析控制台里，最终应该只有这一条：

| 类型 | 主机记录 | 值 | TTL |
| --- | --- | --- | --- |
| CNAME | `blog` | `iamnicwu.github.io` | 600 |

**需要删掉的**（历史遗留，2026-10-12 前存在）：

| 类型 | 主机记录 | 值 |
| --- | --- | --- |
| A | `@` | `185.199.108.153` / `.109.153` / `.110.153` / `.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` / `:8001::` / `:8002::` / `:8003::` |
| CNAME | `www` | `iamnicwu.github.io` |
| CAA | `@` | `0 issue "letsencrypt.org"`（如果当初真的存进去了） |

> 控制台路径：**云解析 DNS → 公网权威解析 → `nickwu.fun` → 解析设置**，
> 逐条点右侧「删除」。删除后 `dig +short A nickwu.fun @223.5.5.5` 应该返回空。

## 让 apex 跳转到博客（如果将来想做）

想让 `nickwu.fun` 也能打开博客，**只有 Cloudflare 这一条免费路**。

### 为什么不用阿里云的 URL 转发

看着最省事，实际走不通。阿里云官方 FAQ 原文：

> **Q: URL 转发是否需要 ICP 备案?**
> **答: 需要。**使用 URL 转发功能时,转发的域名必须已在中国内地完成 ICP 备案。
> 如果域名未完成备案,URL 转发将无法生效,导致访问失败。

原理是转发服务器部署在中国内地，访问者实际是去打那台服务器。个人博客域名走 ICP 备案
不现实。另外它还有三个硬伤：只给 **302**（不是 301）；**不支持带路径参数**
（`nickwu.fun/a/b` 跳过去会丢掉 `/a/b`）；免费版只有 **2 条**。

### Cloudflare Single Redirect 配方

**免费版就有 10 条规则**，支持 wildcard，官方文档里「Redirect apex domain to a subdomain」
就是这个场景。要点：

1. DNS 托管搬到 Cloudflare（步骤见下一节），`nickwu.fun` 加进 Cloudflare。
2. `blog` 那条 CNAME 保持 **DNS only（灰云）** —— 还在给 GitHub 用，铁律不能破。
3. apex 加一条 A 记录，IP 随便填（例如 `192.0.2.1`），Proxy status 选 **Proxied（橙云）**。
   > 这条之所以能开橙云，是因为它**不指向 GitHub**。灰云铁律约束的是指向 GitHub 的记录；
   > 这条记录只会被 Redirect 规则吃掉，请求根本到不了 GitHub，所以不冲突。
4. 加一条 **Single Redirect**：
   - When incoming requests match：`lower(http.host) eq "nickwu.fun" or lower(http.host) eq "www.nickwu.fun"`
   - Then：Dynamic Expression `concat("https://blog.nickwu.fun", http.request.uri.path)`
   - Status code：**301**

完整配置示例见 Cloudflare 文档的 [Set up redirects · Free plan](https://developers.cloudflare.com/learning-paths/get-started-free/other-features/redirects/)。

## 给 GitHub Pages 用 Cloudflare 的铁律：灰云

**所有指向 GitHub 的记录，Proxy status 必须是「DNS only」（灰色云）。**

GitHub Support 原话：

> Cloudflare 默认开启 HTTP/DNS 代理，**导致 GitHub 无法看到生成 HTTPS 证书所需的 DNS 记录**。
> ……**一旦证书签发成功，不要重新开启 Cloudflare 代理，那会导致证书将来无法自动续期。**

开着橙云，Cloudflare 会用**自己的 anycast IP** 应答 DNS，GitHub 就看不到指向自己的记录 →
域名校验失败、证书签不出来；即使签出来了，续期时同样过不了这一关。

> 注意适用范围：这条只管**指向 GitHub 的记录**。指向别处的记录（比如上面给 Redirect
> 用的 apex）开橙云没问题。

## 迁移到 Cloudflare 的步骤（可选）

### 1. 添加站点

cloudflare.com → **Add a site** → 输入 `nickwu.fun` → 选 **Free** 方案。

Cloudflare 会扫描现有记录。**逐条核对**：出现 `76.76.21.21`、`cname.vercel-dns.com`
之类的 Vercel 残留就删掉（2026-10 时 `223.6.6.6` 还有约 20% 的概率返回那个早已失效的 Vercel IP）。
更稳的做法是用 **Import DNS records** 直接导入 `nickwu.fun.zone`。

### 2. 确认 Proxy 状态

所有指向 GitHub 的记录的云朵图标**必须是灰色**。

### 3. 改 NS（在域名注册商侧）

> 阿里云控制台 → 域名 → 域名列表 → `nickwu.fun` → 管理 → **DNS 修改**

改成 Cloudflare 给的两个 NS（形如 `xxx.ns.cloudflare.com`）。

`nickwu.fun` 的 TLD 委派 TTL 只有 **900 秒（15 分钟）**，比常见的一天快得多：

```bash
dig +short NS nickwu.fun @8.8.8.8     # 应变成 xxx.ns.cloudflare.com
```

### 4. 触发一次证书签发

NS 生效后，**只做一次**「移除 + 重新添加自定义域」来重启证书队列：

```bash
# 移除
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/iamnicwu/iamnicwu.github.io/pages -d '{"cname":null}'
# 等约 10 分钟，再加回
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/iamnicwu/iamnicwu.github.io/pages -d '{"cname":"blog.nickwu.fun"}'
```

⚠️ **不要反复删加** —— 每重加一次都会重启证书队列，反而更慢。
GitHub Support 的说法是「触发重查后**证书请求约需一小时**」，别急着下结论。

### 5. 验证

一条命令搞定，覆盖 NS 委派、权威后端一致性、记录取值、CAA、GitHub 侧闸门、边缘证书、跳转：

```bash
node scripts/check-domain.mjs
```

或者只看两个关键点：

```bash
# 闸门是否打开（is_https_eligible 应为 true，caa_error 应为 null）
gh api repos/iamnicwu/iamnicwu.github.io/pages/health

# 证书是否落地（subject 从 CN=*.github.io 变成自己的域名即成功）
echo | openssl s_client -connect blog.nickwu.fun:443 -servername blog.nickwu.fun 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

> `/pages/health` 首次请求返回 **202 + 空 body**（健康检查进行中），重试几次才拿到 200。
> 证书没签发时拿到的是 GitHub 兜底的 `CN=*.github.io` —— 这是"还没轮到你这个域名"最直观的判据。

证书就绪后打开 **Enforce HTTPS**：`PUT /pages` 带 `{"https_enforced":true}`。

### 6. 别开 DNSSEC

Cloudflare 的 DNSSEC 默认关闭，**保持关闭**。开了就得去注册商加 DS 记录，
中途任何一步不一致都会让整域解析失败，收益远小于风险。

## 2026-10-12 排查时遇到过的坑（备忘）

1. **阿里云云解析的多版本不一致。** `dns25`/`dns26.hichina.com` 共 16 台后端，
   SOA 序列号横跨 `2022082217`（2022 年！）/ `2026081813` / `2026082509` / `2026082616` / `2026082617`。
   A 记录碰巧一致，但这是 `dns_resolves` 在 true/false 之间抖的根源。
   定位手法：**逐台 IP 直查 SOA 序列号再比对**（单台 NS 挂 8 条 A，轮询会命中不同后端）。
2. **AliDNS 泄漏陈旧的 Vercel IP。** `223.6.6.6` 采样 10 次有 2 次返回 `76.76.21.21`。
3. **`caa_error` 为 `null` 有两种含义**：闸门打开（校验通过）**或**跳过了校验（DNS 都解析不到）。
   要结合 `is_https_eligible` 和 `dns_resolves` 一起看，别只看一个字段。
4. **`https_certificate` 字段在证书签发前根本不出现**，它的缺席就是"还没签发"，
   不要误读成 API 不支持。
5. **「移除 + 重加」在 legacy 模式下用 API 清 `cname` 是有效的**，
   不需要去改 `master` 上的 CNAME 文件；清掉后等构建完成，自定义域会真的 404。
6. **`dig +short CAA <子域名>` 返回的是 CNAME target**，不是错误。
   dig 对没有 CAA 记录的子域名就是这么答的 —— 别把它当成"记录配错了"。
7. **别用 `grep "a\|b"` 在 macOS 上做交替匹配**，BSD grep 不支持，会**静默零匹配**，
   看起来像"没有残留"其实什么都没查。用 `grep -E` 或 ripgrep。
