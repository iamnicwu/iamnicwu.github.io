# 域名与 DNS 说明

## 最终方案：博客在 `blog.nickwu.fun`

2026-10-12 最终定下的形态。**用子域名而不是 apex 是刻意的，不是将就。**

| | |
| --- | --- |
| 博客地址 | `https://blog.nickwu.fun/` |
| 记录 | `blog` CNAME → `iamnicwu.github.io`（**不带仓库名**） |
| apex `nickwu.fun` | 不再承载博客，空出来给别的服务（比如把 LobeChat 放回去） |

### 为什么必须是子域名

子域名走 **CNAME**，而按 RFC 8659，**CAA 查询遇到 CNAME 要跟着走到目标域** ——
于是校验落在 `iamnicwu.github.io` → `github.io`（GitHub 自家 DNS）上，**永远不会超时**。

apex 只能走 A 记录，CAA 必须直查 `nickwu.fun` 的权威 NS（当时是阿里云 `dns25/dns26.hichina.com`），
**无记录时还要向上递归到 `.fun` 顶级域并做 DNSSEC「无 DS」证明**。这条路在 GitHub 的解析器
（Ruby 的 Dnsruby）上会**间歇性超时**：

```
apex nickwu.fun:  caa_error = "Dnsruby::ResolvTimeout"   is_https_eligible 在 true/false 之间反复抖
```

`is_https_eligible` 就是证书签发的闸门 —— 它抖，证书就**永远签不出来**。
实测 `www` 的闸门**一次都没关过**，apex 则几分钟一跳。这就是换子域名的全部理由。

## 记录清单

见同目录的 [`nickwu.fun.zone`](./nickwu.fun.zone)，可直接导入 Cloudflare。

| 类型 | 主机记录 | 值 | Proxy |
| --- | --- | --- | --- |
| CNAME | `blog` | `iamnicwu.github.io` | DNS only |
| CAA | `@` | `0 issue "letsencrypt.org"` | — |

## 给 GitHub Pages 用 Cloudflare 的铁律：灰云

**所有指向 GitHub 的记录，Proxy status 必须是「DNS only」（灰色云）。**

GitHub Support 原话：

> Cloudflare 默认开启 HTTP/DNS 代理，**导致 GitHub 无法看到生成 HTTPS 证书所需的 DNS 记录**。
> ……**一旦证书签发成功，不要重新开启 Cloudflare 代理，那会导致证书将来无法自动续期。**

开着橙云，Cloudflare 会用**自己的 anycast IP** 应答 DNS，GitHub 就看不到指向自己的记录 →
域名校验失败、证书签不出来；即使签出来了，续期时同样过不了这一关。

## 迁移到 Cloudflare 的步骤

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
