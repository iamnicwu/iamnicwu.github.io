# 把 nickwu.fun 的 DNS 托管迁到 Cloudflare

## 为什么要迁

2026-10-12 迁移时踩到的问题，三个是同一个源头（阿里云云解析）：

1. **HTTPS 证书一直不签发。** `GET /repos/iamnicwu/iamnicwu.github.io/pages/health` 显示
   apex 的 `caa_error: Dnsruby::ResolvTimeout`、`is_https_eligible: false` ——
   GitHub 自家解析器查 apex 的 CAA 记录时超时，这就是签发闸门。
   （`www` 没事，因为它是 CNAME，按 RFC 8659 其 CAA 校验落在 `github.io` 上，走的是 GitHub 自家 DNS。）

2. **zone 多版本不一致。** `dns25`/`dns26.hichina.com` 共 16 台后端，SOA 序列号横跨
   `2026081813` ～ `2026082815`，甚至有节点是 2022 年的旧版本。A 记录碰巧一致，但这也是
   GitHub 侧 `dns_resolves` 在 true/false 之间抖动的原因。

3. **AliDNS 泄漏陈旧的 Vercel IP。** `223.6.6.6` 采样 10 次里有 2 次返回 `76.76.21.21`
   （LobeChat 时期的 Vercel 地址，站点早已不在那）。AliDNS 是国内多数用户的默认解析器。

Cloudflare 免费版可以一次解决这三个问题。

## 记录清单

见同目录的 [`nickwu.fun.zone`](./nickwu.fun.zone)，可直接导入。

| 类型 | 主机记录 | 值 | Proxy |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| AAAA | `@` | `2606:50c0:8000::153` | DNS only |
| AAAA | `@` | `2606:50c0:8001::153` | DNS only |
| AAAA | `@` | `2606:50c0:8002::153` | DNS only |
| AAAA | `@` | `2606:50c0:8003::153` | DNS only |
| CNAME | `www` | `iamnicwu.github.io` | DNS only |
| CAA | `@` | `0 issue "letsencrypt.org"` | — |

## 步骤

### 1. 在 Cloudflare 添加站点

- 注册/登录 cloudflare.com → **Add a site** → 输入 `nickwu.fun` → 选 **Free** 方案
- Cloudflare 会扫描现有记录。**扫描结果必须逐条核对**：只要出现 `76.76.21.21`、
  `cname.vercel-dns.com` 之类的 Vercel 残留，一律删掉。
- 更稳的做法是用 **Import DNS records** 直接导入 `nickwu.fun.zone`，
  然后再手工核对一遍有没有多余记录。

### 2. 确认 Proxy 状态

**所有记录的云朵图标必须是灰色（DNS only）。** 开着橙云（代理）会让 GitHub 无法校验域名，
Let's Encrypt 的 HTTP-01 挑战也会失败。

### 3. 改 NS（在域名注册商侧，不是解析侧）

这一步在**阿里云域名控制台**做，不是云解析 DNS 控制台：

> 阿里云控制台 → 域名 → 域名列表 → `nickwu.fun` → 管理 → **DNS 修改**（或"修改DNS服务器"）
> → 改成 Cloudflare 给的两个 NS（形如 `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`）

Cloudflare 面板会在添加站点后直接显示这两个 NS。

### 4. 等 NS 生效

`nickwu.fun` 的 TLD 委派 TTL 是 **900 秒（15 分钟）**，比常见的一天快得多。
验证：

```bash
dig +short NS nickwu.fun @8.8.8.8     # 应变成 xxx.ns.cloudflare.com
```

### 5. 触发一次证书签发

NS 生效后，**只做一次**「移除 + 重新添加自定义域」来重启证书队列：

```bash
# 移除
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/iamnicwu/iamnicwu.github.io/pages -d '{"cname":null}'
# 等约 10 分钟，再加回
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/iamnicwu/iamnicwu.github.io/pages -d '{"cname":"nickwu.fun"}'
```

⚠️ **不要反复删加** —— 每重加一次都会重启队列，反而更慢。

### 6. 盯签发进度

```bash
# 闸门是否打开（caa_error 应为 null、is_https_eligible 应为 true）
gh api repos/iamnicwu/iamnicwu.github.io/pages/health

# 证书是否落地（subject 从 CN=*.github.io 变成自己的域名即成功）
echo | openssl s_client -connect nickwu.fun:443 -servername nickwu.fun 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

证书就绪后打开 **Enforce HTTPS**：`PUT /pages` 带 `{"https_enforced":true}`。

> 注意 `/pages/health` 首次请求会返回 **202 + 空 body**（健康检查进行中），重试几次才拿到 200。
> 证书没签发时 `openssl` 拿到的是 GitHub 兜底的 `CN=*.github.io` ——
> 这是"还没轮到你这个域名"最直观的判据。

### 7. 别开 DNSSEC

Cloudflare 的 DNSSEC 默认关闭，**保持关闭**。开了就得去注册商加 DS 记录，
中途任何一步不一致都会让整域解析失败，收益远小于风险。
