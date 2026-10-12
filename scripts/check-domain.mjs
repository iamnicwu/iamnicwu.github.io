#!/usr/bin/env node
// 域名体检：一条命令看清 blog.nickwu.fun 的解析、GitHub Pages 侧判断、和 HTTPS 证书状态。
//
// 用法：
//   node scripts/check-domain.mjs            # 用系统默认解析器
//   node scripts/check-domain.mjs 223.5.5.5  # 指定解析器（可传多个）
//
// 为什么值得单独写一个：排查域名迁移时，出问题的地方分散在四个层面
// （权威 DNS / 公共 DNS 缓存 / GitHub 的 pages/health / 边缘节点的 TLS 证书），
// 挨个手动 dig + curl 很容易漏，而且 pages/health 首次会返回 202 空 body
// 这点很容易误判成接口坏了。
//
// ⚠️ 关于 apex：nickwu.fun 是**刻意不解析**的（2026-10-12 决定，把主域腾出来）。
//    所以这里的期望值就是「空」。脚本把「空」判成 ✅ 而不是 ❌ ——
//    看到 apex 无记录是预期行为，不要去「修」它。原因见 dns/README.md。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 站点域名从 hugo.toml 读，避免换域名后脚本还在检查旧域名（会一路报假绿）
const BLOG = (fs.readFileSync(path.join(ROOT, "hugo.toml"), "utf8").match(/^\s*baseURL\s*=\s*"https?:\/\/([^/"]+)/m) || [])[1] || "blog.nickwu.fun";
const parts = BLOG.split(".");
const APEX = parts.length > 2 ? parts.slice(1).join(".") : BLOG;

const REPO = "iamnicwu/iamnicwu.github.io";
const RESOLVERS = process.argv.slice(2).length ? process.argv.slice(2) : null;

const GH_A = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];
const GH_AAAA = ["2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153"];

const sh = (cmd) => {
  // 结尾补 || true：curl 在 DNS 失败 / SSL 校验失败时退出码非 0，不吞掉它的输出
  try { return execFileSync("bash", ["-c", `${cmd} || true`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
};
const dig = (args) => sh(`dig ${args} +time=4 +tries=1 2>/dev/null`).split("\n").map((s) => s.trim()).filter(Boolean);

const line = (s = "") => console.log(s);
const head = (s) => { line(); line(`── ${s} ${"─".repeat(Math.max(0, 58 - s.length))}`); };
const same = (got, want) => [...got].sort().join(",") === [...want].sort().join(",");

line(`域名: ${BLOG}   （apex: ${APEX}，刻意不解析）`);

// ---------- 1. 委派与 NS ----------
head("1. 委派与权威 NS");
const nsList = dig(`+short NS ${APEX} @8.8.8.8`);
line(`  ${APEX} NS: ${nsList.join(", ") || "(取不到)"}`);
const onCF = nsList.some((n) => n.includes("ns.cloudflare.com"));
line(`  托管商: ${onCF ? "Cloudflare ✅" : nsList.some((n) => n.includes("hichina")) ? "阿里云云解析" : "(未知)"}`);
// 只在「真的答了」的解析器之间比一致性 —— 某些解析器（如 1.1.1.1）在受限网络里
// 会直接超时，dig 吐的是 "connection timed out" 而不是 NS 列表。
// 不排除掉它，就会把「我这里连不上」误报成「NS 委派不一致」。
const cfNS = ["1.1.1.1", "8.8.8.8"]
  .map((r) => ({ r, ns: dig(`+short NS ${APEX} @${r}`).filter((x) => x.includes(".")).join("|") }))
  .filter((x) => x.ns);
for (const x of cfNS) line(`  经 ${x.r}: ${x.ns}`);
if (new Set(cfNS.map((x) => x.ns)).size > 1) line(`  ⚠️  不同解析器看到的 NS 不一致 —— 委派可能还没传播完`);
if (cfNS.length < 2) line("  （部分解析器无应答，已跳过一致性比对；通常是本机网络限制，不是委派问题）");

// ---------- 2. 权威后端一致性（多版本 zone 是这次踩到的坑） ----------
head("2. 权威后端一致性");
const authIPs = [];
for (const ns of nsList.slice(0, 2)) {
  const ips = dig(`+short A ${ns} @8.8.8.8`);
  for (const ip of (ips.length > 12 ? ips.slice(0, 12) : ips)) {
    const serial = dig(`+short SOA ${APEX} @${ip}`)[0]?.split(/\s+/)[2];
    const a = dig(`+short A ${APEX} @${ip}`).sort().join(",");
    authIPs.push({ ip, serial, a });
  }
}
const serials = [...new Set(authIPs.map((x) => x.serial).filter(Boolean))];
line(`  探测后端: ${authIPs.length} 台，其中有效应答 ${authIPs.filter((x) => x.serial).length} 台`);
if (serials.length > 1) {
  line(`  ⚠️  发现 ${serials.length} 个不同的 zone 版本（SOA 序列号）:`);
  for (const s of serials.sort()) line(`        ${s}  ← ${authIPs.filter((x) => x.serial === s).length} 台`);
} else if (serials.length === 1) {
  line(`  ✅ 所有后端一致，SOA 序列号 ${serials[0]}`);
} else {
  line("  （后端直查无应答，可能被限速）");
}

// ---------- 3. 记录取值 ----------
head("3. 记录取值");
line(`  期望：${BLOG} 的 CNAME 指向 iamnicwu.github.io；${APEX} 与 www.${APEX} 全空`);
const resolvers = RESOLVERS || ["223.5.5.5", "119.29.29.29", "8.8.8.8"];
for (const r of resolvers) {
  const cname = dig(`+short CNAME ${BLOG} @${r}`)[0];
  const a = dig(`+short A ${BLOG} @${r}`).filter((x) => /^[\d.]+$/.test(x));
  const apexA = dig(`+short A ${APEX} @${r}`).filter((x) => /^[\d.]+$/.test(x));
  const apexAAAA = dig(`+short AAAA ${APEX} @${r}`).filter((x) => x.includes(":"));
  const wwwA = dig(`+short A www.${APEX} @${r}`).filter((x) => /^[\d.]+$/.test(x));
  const wwwC = dig(`+short CNAME www.${APEX} @${r}`)[0];

  line(`  via ${r}`);
  line(`    ${BLOG} CNAME : ${cname === "iamnicwu.github.io." ? "✅" : "❌"} ${cname || "(空)"}`);
  // 「只有 CNAME 没有 A」是**权威服务器应答的正常形态**：权威不负责追 CNAME 目标。
  // 公共解析器（119.29 / 8.8.8.8）会替你跟一步，所以那里能看到 A。
  // 两者都算通过，别把权威的裸 CNAME 报成故障。
  const aMsg = a.length === 0
    ? "（仅 CNAME —— 权威应答的正常形态，公共解析器会自动补 A）"
    : (same(a, GH_A) ? "✅ " : "⚠️  不是 GitHub 的 IP: ") + a.join(", ");
  line(`      └ A          : ${aMsg}`);
  line(`    ${APEX} A/AAAA   : ${apexA.length === 0 && apexAAAA.length === 0 ? "✅ 空（预期）" : "⚠️  有记录，本该删掉"} ${[...apexA, ...apexAAAA].join(", ")}`);
  const wwwStr = [wwwC, ...wwwA].filter(Boolean).join(", ");
  line(`    www.${APEX}      : ${wwwStr ? "⚠️  有记录，本该删掉  " + wwwStr : "✅ 空（预期）"}`);
}

// ---------- 4. CAA ----------
head("4. CAA 记录");
// blog 是 CNAME，按 RFC 8659 校验会跟着走到 github.io，apex 上的 CAA 问不到它
const caaBlog = dig(`+short CAA ${BLOG} @8.8.8.8`).filter((l) => /issue|iodef/.test(l));
const caaGH = dig(`+short CAA github.io @8.8.8.8`).filter((l) => /issue|iodef/.test(l));
const caaApex = dig(`+short CAA ${APEX} @8.8.8.8`).filter((l) => /issue|iodef/.test(l));
line(`  github.io 上的 CAA: ${caaGH.length ? caaGH.join(" | ") : "（无）"}  ← 证书实际受它约束`);
line(`  ${APEX} 上的 CAA     : ${caaApex.length ? caaApex.join(" | ") : "（无，刻意保持）"}`);
line(`  ${BLOG} 直查      : ${caaBlog.length ? caaBlog.join(" | ") : "（无）"}`);
if (caaApex.length) {
  line(`  ⚠️  apex 上有 CAA —— 会按域树继承，限制 ${APEX} 下所有子域名能用的 CA。`);
  line(`     你现在不需要它，建议删掉；不删的话将来给子域名签证书可能莫名失败。`);
} else {
  line("  ✅ apex 无 CAA（预期）。不影响 blog 的签发，也不会约束将来的子域名。");
}

// ---------- 5. GitHub Pages 侧判断 ----------
head("5. GitHub Pages 侧判断");
const token = process.env.GITHUB_TOKEN
  || (fs.existsSync(`${process.env.HOME}/.workbuddy/.gh-token`) ? fs.readFileSync(`${process.env.HOME}/.workbuddy/.gh-token`, "utf8").trim() : "");
if (!token) {
  line("  （跳过：没有 GitHub token。设置 GITHUB_TOKEN 或写一个到 ~/.workbuddy/.gh-token）");
} else {
  const api = async (url) => {
    const r = await fetch(`https://api.github.com/repos/${REPO}${url}`, {
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
  if (st.json?.cname !== BLOG) line(`  ❌ Pages 的自定义域是 ${st.json?.cname}，与站点域名 ${BLOG} 不一致 —— master 上的 CNAME 文件可能还没部署`);
  if (!h) {
    line("  ⚠️  health 一直没返回 200（可能被限速）");
  } else {
    const d = h.domain;
    if (d) {
      line(`  ${d.host}: dns_resolves=${d.dns_resolves} caa_error=${d.caa_error ?? "null"} is_https_eligible=${d.is_https_eligible} ${d.is_https_eligible ? "✅" : "❌"}`);
      if (d.reason) line(`        reason: ${String(d.reason).replace(/<[^>]+>/g, "").slice(0, 110)}`);
      if (!d.is_https_eligible) line("  ❌ 签发闸门是关着的 —— 证书永远不会自动签发，不用等");
    }
    const alt = h.alt_domain;
    if (alt?.host) line(`  ${alt.host}（备选域）: is_https_eligible=${alt.is_https_eligible}`);
  }
}

// ---------- 6. 边缘 TLS 证书 ----------
head("6. 边缘 TLS 证书");
const subj = sh(`echo | openssl s_client -connect ${BLOG}:443 -servername ${BLOG} 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null`);
if (!subj) {
  line("  ❌ 拿不到证书（连接失败）");
} else {
  const isFallback = /CN=\*\.github\.io/.test(subj);
  subj.split("\n").forEach((l) => line("  " + l));
  line(`  ${isFallback ? "⚠️  还是 GitHub 兜底的 *.github.io —— 证书尚未为本域名签发" : "✅ 已是本域名自己的证书"}`);
}
const https = sh(`curl -s --noproxy '*' --max-time 15 -o /dev/null -w '%{http_code} %{ssl_verify_result}' -L --max-redirs 3 https://${BLOG}/ 2>/dev/null`);
line(`  https 请求: HTTP=${https.split(" ")[0] || "?"} ssl_verify_result=${https.split(" ")[1] ?? "?"}  ${https.startsWith("200 0") ? "✅ 正常" : "⚠️"}`);

// ---------- 7. 跳转关系 ----------
head("7. 跳转关系");
const jumps = [
  [`http://${BLOG}/`, `→ https://${BLOG}/（开了 Enforce HTTPS 后）`],
  [`http://iamnicwu.github.io/`, `→ ${BLOG}`],
  [`https://${BLOG}/`, "200 正常"],
  [`http://${APEX}/`, "无解析 000（预期）"],
  [`http://www.${APEX}/`, "无解析 000（预期）"],
];
for (const [u, expect] of jumps) {
  const out = sh(`curl -s --noproxy '*' --max-time 12 -o /dev/null -w '%{http_code}|%{redirect_url}' '${u}'`);
  const [code, loc] = out.split("|");
  line(`  ${u.padEnd(32)} → ${(code || "000").padEnd(4)} ${loc ? loc.padEnd(30) : "".padEnd(30)} 期望 ${expect}`);
}
line();
line("判据速查：");
line("  · caa_error 非 null + is_https_eligible=false → 卡在 GitHub 侧，等不到证书");
line("  · 证书是 CN=*.github.io                       → 本域名的证书还没签发");
line("  · 多个 SOA 序列号                             → 权威 NS 多版本不一致（换托管商）");
line("  · apex 无记录                                 → ✅ 预期，2026-10-12 起刻意留空");
line();
