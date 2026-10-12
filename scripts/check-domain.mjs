#!/usr/bin/env node
// 域名体检：一条命令看清 nickwu.fun 的解析、GitHub Pages 侧判断、和 HTTPS 证书状态。
//
// 用法：
//   node scripts/check-domain.mjs            # 用系统默认解析器
//   node scripts/check-domain.mjs 223.5.5.5  # 指定解析器（可传多个）
//
// 为什么值得单独写一个：这次排查域名迁移时，出问题的地方分散在四个层面
// （权威 DNS / 公共 DNS 缓存 / GitHub 的 pages/health / 边缘节点的 TLS 证书），
// 挨个手动 dig + curl 很容易漏，而且 pages/health 首次会返回 202 空 body 这点很容易误判成接口坏了。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = (fs.readFileSync(path.join(ROOT, "hugo.toml"), "utf8").match(/^\s*baseURL\s*=\s*"https?:\/\/([^/"]+)/m) || [])[1] || "nickwu.fun";
const REPO = "iamnicwu/iamnicwu.github.io";
const RESOLVERS = process.argv.slice(2).length ? process.argv.slice(2) : null;

const GH_A = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];
const GH_AAAA = ["2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153"];

const sh = (cmd) => {
  // 结尾补 || true：curl 在 SSL 校验失败时退出码非 0，不吞掉它的输出
  try { return execFileSync("bash", ["-c", `${cmd} || true`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
};
const dig = (args) => sh(`dig ${args} +time=4 +tries=1 2>/dev/null`).split("\n").map((s) => s.trim()).filter(Boolean);

const line = (s = "") => console.log(s);
const head = (s) => { line(); line(`── ${s} ${"─".repeat(Math.max(0, 58 - s.length))}`); };

// ---------- 1. 委派与 NS ----------
head("1. 委派与权威 NS");
const nsList = dig(`+short NS ${DOMAIN} @8.8.8.8`);
line(`  NS: ${nsList.join(", ") || "(取不到)"}`);
const onCloudflare = nsList.some((n) => n.includes("ns.cloudflare.com"));
line(`  托管商: ${onCloudflare ? "Cloudflare ✅" : nsList.some((n) => n.includes("hichina")) ? "阿里云云解析（计划迁往 Cloudflare）" : "(未知)"}`);
const cfNS = ["1.1.1.1", "8.8.8.8"].map((r) => dig(`+short NS ${DOMAIN} @${r}`).join("|"));
if (new Set(cfNS).size > 1) line(`  ⚠️  不同解析器看到的 NS 不一致: ${cfNS.join("  vs  ")}`);

// ---------- 2. 权威后端一致性（多版本 zone 是这次踩到的坑） ----------
head("2. 权威后端一致性");
const authIPs = [];
for (const ns of nsList.slice(0, 2)) {
  const ips = dig(`+short A ${ns} @8.8.8.8`);
  const probe = ips.length > 12 ? ips.slice(0, 12) : ips;
  for (const ip of probe) {
    const serial = dig(`+short SOA ${DOMAIN} @${ip}`)[0]?.split(/\s+/)[2];
    const a = dig(`+short A ${DOMAIN} @${ip}`).sort().join(",");
    authIPs.push({ ip, serial, a });
  }
}
const serials = [...new Set(authIPs.map((x) => x.serial).filter(Boolean))];
line(`  探测后端: ${authIPs.length} 台，其中有效应答 ${serials.length ? authIPs.length : 0} 台`);
if (serials.length > 1) {
  line(`  ⚠️  发现 ${serials.length} 个不同的 zone 版本（SOA 序列号）:`);
  for (const s of serials.sort()) line(`        ${s}  ← ${authIPs.filter((x) => x.serial === s).length} 台`);
} else if (serials.length === 1) {
  line(`  ✅ 所有后端一致，SOA 序列号 ${serials[0]}`);
} else {
  line("  （后端直查无应答，可能被限速）");
}
const aSets = [...new Set(authIPs.map((x) => x.a).filter(Boolean))];
if (aSets.length > 1) line(`  ⚠️  A 记录在各后端间也不一致:\n${aSets.map((s) => "        " + s).join("\n")}`);

// ---------- 3. 记录取值 ----------
head("3. 记录取值（默认解析器 + 指定解析器）");
const check = (label, got, want) => {
  const same = [...got].sort().join(",") === [...want].sort().join(",");
  line(`  ${label}: ${same ? "✅" : "❌"} ${got.join(", ") || "(空)"}`);
  if (!same) line(`        期望: ${want.join(", ")}`);
};
const resolvers = RESOLVERS || ["223.5.5.5", "119.29.29.29", "8.8.8.8"];
for (const r of resolvers) {
  const a = dig(`+short A ${DOMAIN} @${r}`).filter((x) => /^[\d.]+$/.test(x));
  const aaaa = dig(`+short AAAA ${DOMAIN} @${r}`).filter((x) => x.includes(":"));
  const www = dig(`+short CNAME www.${DOMAIN} @${r}`)[0];
  line(`  via ${r}`);
  check(`    A   `, a, GH_A);
  check(`    AAAA`, aaaa, GH_AAAA);
  line(`    www : ${www === "iamnicwu.github.io." ? "✅" : "❌"} ${www || "(空)"}`);
}

// ---------- 4. CAA（证书签发的关键前置） ----------
head("4. CAA 记录");
const caaAuth = dig(`+short CAA ${DOMAIN} @${nsList[0] || "8.8.8.8"}`);
const caaPub = dig(`+short CAA ${DOMAIN} @8.8.8.8`);
if (caaAuth.length === 0 && caaPub.length === 0) {
  line("  ⚠️  没有 CAA 记录（不阻塞签发，但 resolver 需向父域递归查询，某些 NS 上会超时）");
  line('     建议加: CAA @ 0 issue "letsencrypt.org"');
} else {
  const okLE = caaPub.some((l) => /issue\s+"letsencrypt\.org"/.test(l));
  line(`  ${okLE ? "✅" : "❌"} ${caaPub.join(" | ") || caaAuth.join(" | ")}`);
  if (!okLE) line("     ⚠️  没有授权 letsencrypt.org —— GitHub Pages 用 Let's Encrypt 签证书，这会直接导致签发失败");
}

// ---------- 5. GitHub Pages 侧判断 ----------
head("5. GitHub Pages 侧判断");
const token = process.env.GITHUB_TOKEN
  || (fs.existsSync(`${process.env.HOME}/.workbuddy/.gh-token`) ? fs.readFileSync(`${process.env.HOME}/.workbuddy/.gh-token`, "utf8").trim() : "");
if (!token) {
  line("  （跳过：没有 GitHub token。设置 GITHUB_TOKEN 或写一个到 ~/.workbuddy/.gh-token）");
} else {
  const api = async (url, opt = {}) => {
    const r = await fetch(`https://api.github.com/repos/${REPO}${url}`, {
      ...opt,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "check-domain" },
    });
    return { status: r.status, json: JSON.parse((await r.text()) || "null") };
  };
  // health 首次会返回 202 + 空 body（检查进行中），必须重试
  let h = null;
  for (let i = 0; i < 10 && !h; i++) {
    const r = await api("/pages/health");
    if (r.status === 200 && r.json?.domain) h = r.json;
    else await new Promise((s) => setTimeout(s, 6000));
  }
  const st = await api("/pages");
  line(`  Pages: status=${st.json?.status} cname=${st.json?.cname} https_enforced=${st.json?.https_enforced} cert=${st.json?.https_certificate?.state ?? "(无)"}`);
  if (!h) {
    line("  ⚠️  health 一直没返回 200（可能被限速）");
  } else {
    for (const [label, d] of [["apex", h.domain], ["www ", h.alt_domain]]) {
      if (!d) continue;
      const ok = d.is_https_eligible;
      line(`  ${label}: dns_resolves=${d.dns_resolves} caa_error=${d.caa_error ?? "null"} is_https_eligible=${ok} ${ok ? "✅" : "❌"}`);
      if (d.reason) line(`        reason: ${String(d.reason).replace(/<[^>]+>/g, "").slice(0, 110)}`);
    }
    if (!h.domain?.is_https_eligible) line("  ❌ 签发闸门是关着的 —— 证书永远不会自动签发，不用等");
  }
}

// ---------- 6. 边缘 TLS 证书 ----------
head("6. 边缘 TLS 证书");
const subj = sh(`echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null`);
if (!subj) {
  line("  ❌ 拿不到证书（连接失败）");
} else {
  const isFallback = /CN=\*\*\.github\.io|CN=\*\.github\.io/.test(subj);
  subj.split("\n").forEach((l) => line("  " + l));
  line(`  ${isFallback ? "⚠️  还是 GitHub 兜底的 *.github.io —— 说明证书尚未为本域名签发" : "✅ 已是本域名自己的证书"}`);
}
const https = sh(`curl -s --noproxy '*' --max-time 15 -o /dev/null -w '%{http_code} %{ssl_verify_result}' -L --max-redirs 3 https://${DOMAIN}/ 2>/dev/null`);
line(`  https 请求: HTTP=${https.split(" ")[0] || "?"} ssl_verify_result=${https.split(" ")[1] ?? "?"}  ${https.startsWith("200 0") ? "✅ 正常" : "⚠️"}`);

// ---------- 7. 跳转 ----------
head("7. 跳转关系");
for (const u of [`http://${DOMAIN}/`, `http://www.${DOMAIN}/`, "http://iamnicwu.github.io/"]) {
  const code = sh(`curl -s --noproxy '*' --max-time 15 -o /dev/null -w '%{http_code}' '${u}'`);
  const loc = sh(`curl -s --noproxy '*' --max-time 15 -o /dev/null -w '%{redirect_url}' '${u}'`);
  line(`  ${u.padEnd(34)} → ${code}${loc ? "  跳转到 " + loc : ""}`);
}
line();
line("判据速查：");
line("  · caa_error 非 null + is_https_eligible=false → 卡在 GitHub 侧，等不到证书");
line("  · 证书是 CN=*.github.io                       → 本域名的证书还没签发");
line("  · 多个 SOA 序列号                             → 权威 NS 多版本不一致（换托管商）");
line();
