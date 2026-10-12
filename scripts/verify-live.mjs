#!/usr/bin/env node
// 线上全站体检：从首页 BFS 爬遍站内链接，逐个请求检查状态码，并抓「被跳到站外」的回环。
//
// 用法：
//   node scripts/verify-live.mjs                    # 默认爬 hugo.toml 里 baseURL 的域名
//   node scripts/verify-live.mjs https://blog.nickwu.fun
//
// 为什么需要它：改域名、换主题、加渲染钩子之后，「页面 200 但站内某个链接 404」
// 这类问题肉眼绝对看不出来。切到 blog.nickwu.fun 当天就是靠它确认整站可用的。
//
// 与 scripts/check-domain.mjs 的分工：
//   check-domain.mjs  ← 域名/DNS/证书这一层（解析、CAA、Pages 闸门、TLS）
//   verify-live.mjs   ← 站点内容这一层（每个 URL 通不通、有没有跳去站外）
process.env.NO_PROXY = "*";
for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) delete process.env[k];

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fromConfig = (fs.readFileSync(path.join(ROOT, "hugo.toml"), "utf8").match(/^\s*baseURL\s*=\s*"([^"]+)"/m) || [])[1];
const ORIGIN = (process.argv[2] || fromConfig || "https://blog.nickwu.fun").replace(/\/+$/, "");
const HOST = new URL(ORIGIN).hostname;
const MAX = 500;

const seen = new Set();
const queue = ["/"];
const results = new Map();
const redirects = new Map();
let failed = false;

const canon = (u) => {
  try {
    const url = new URL(u, ORIGIN);
    // 按「主机名」而不是「origin」比对：站内链接可能写成 https:// 而我们从 http:// 起爬，
    // 用 origin 比会把这类同域链接全部误判成外链，漏掉整片页面。
    if (url.hostname !== HOST) return null;
    return url.pathname + (url.search || "");
  } catch {
    return null;
  }
};

async function get(pathname) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(ORIGIN + pathname, {
        redirect: "follow",
        headers: { "Cache-Control": "no-cache" },
      });
      return {
        status: r.status,
        finalUrl: r.url,
        body: r.status === 200 && /text\/html/.test(r.headers.get("content-type") || "") ? await r.text() : null,
      };
    } catch (e) {
      if (i === 2) return { status: 0, err: e.message };
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

// ⚠️ 提取链接必须**只认标签**，不能扫全文。这是踩出来的：
//
// 文章 nforce-autotest 里有一张表格在讲目标选择器的四种写法，某个单元格写着
//     xpath=//a[@href='/home']
// 用宽松的 `(?:href|src)=` 扫全文会把它当成真链接，于是爬虫去请求 /home 拿到 404，
// 报出一个**根本不存在的站点故障**（我一开始就是这么被骗的）。
//
// 剥 <pre>/<code> 只能挡住代码块里的那一份，挡不住正文里的行内代码 —— 所以正解是收紧正则：
// 必须真的是 `<a href=` / `<link href=` / `<script src=` 这种标签才算。
// 代码块里的标签会被 markdown 渲染器转义成 `&lt;a href=`，天然不会误匹配。
const LINK_RE = /<a\s[^>]*?href=["']?([^"'\s>]+)|<(?:link|script|img|source)\s[^>]*?(?:href|src)=["']?([^"'\s>]+)/gi;

const extract = (html) =>
  html
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<code[\s\S]*?<\/code>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .matchAll(LINK_RE);

let pages = 0,
  assets = 0;
while (queue.length && results.size < MAX) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  const res = await get(p);
  const isPage = p.endsWith("/") || p.endsWith(".html");
  if (res.status === 200) isPage ? pages++ : assets++;
  if (res.status !== 200) failed = true;

  // 落点跟请求地址不同域 → 被重定向到了别处（换域名时用来抓「新域名 301 回旧域名」这种回环）
  if (res.finalUrl) {
    const fu = res.finalUrl.replace(/\/+$/, "");
    if (fu !== ORIGIN + p.replace(/\/+$/, "") && !fu.startsWith(ORIGIN)) redirects.set(p, res.finalUrl);
  }

  console.log(`${res.status === 200 ? "✓" : "✗"} ${String(res.status).padEnd(4)} ${p}${res.err ? "  " + res.err : ""}`);
  results.set(p, res.status);

  if (res.body) {
    for (const m of extract(res.body)) {
      const c = canon(m[1] || m[2]);
      if (c && !seen.has(c) && !c.startsWith("/#")) queue.push(c);
    }
  }
}

console.log(`\n共请求 ${results.size} 个 URL（页面 ${pages} / 资源 ${assets}）`);
if (redirects.size) {
  console.log(`⚠️  ${redirects.size} 个地址被跳到了站外：`);
  for (const [k, v] of [...redirects].slice(0, 10)) console.log(`    ${k} → ${v}`);
} else {
  console.log("✅ 无站外跳转");
}
console.log(failed ? "❌ 存在非 200 响应（见上）" : "✅ 全部 200");
process.exit(failed ? 1 : 0);
