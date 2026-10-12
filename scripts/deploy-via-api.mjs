// 经 GitHub Git Data API 把 public/ 发布到 master —— deploy.sh 的备用通道。
//
// 什么时候用它：本机到 github.com 的出口不通时（git clone / git push 都走它），
// 但 api.github.com 往往还能连上。典型报错是
//   fatal: unable to access 'https://github.com/…': Failed to connect to github.com port 443
//
// 相比 deploy.sh 的额外好处：新提交用的是「整棵新树」，不含的路径会自然消失，
// 因此不需要 rsync --delete 那一步，也不会误删 master 上无意保留的东西。
//
// 用法：node scripts/deploy-via-api.mjs "提交说明"
// 前置：public/ 已构建（先跑 hugo --minify --cleanDestinationDir）
// 令牌：~/.workbuddy/.gh-token（细粒度或经典 PAT 均可，需 repo 写权限）
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const BRANCH = "master";

// 仓库从 remote 推导，别在脚本里写死
const remote = execFileSync("git", ["-C", ROOT, "config", "--get", "remote.origin.url"], { encoding: "utf8" }).trim();
const m = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
if (!m) throw new Error(`无法从 remote 解析出 owner/repo：${remote}`);
const [, OWNER, REPO] = m;

const tokenPath = path.join(process.env.HOME, ".workbuddy", ".gh-token");
if (!fs.existsSync(tokenPath)) throw new Error(`找不到令牌文件 ${tokenPath}`);
const TOKEN = fs.readFileSync(tokenPath, "utf8").trim();

const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "deploy-via-api",
};
// 环境里的 HTTP_PROXY 会把 api.github.com 也送进代理；直连更稳
process.env.NO_PROXY = "*";

async function api(method, url, body) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res;
    try {
      res = await fetch(url.startsWith("http") ? url : API + url, {
        method,
        headers: { ...HEADERS, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (attempt === 4) throw new Error(`${method} ${url} 网络失败：${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    const txt = await res.text();
    if (res.status === 403 || res.status === 429) {
      if (attempt === 4) throw new Error(`${method} ${url} -> ${res.status}：${txt.slice(0, 300)}`);
      console.log(`  … ${res.status} 限流，${attempt}s 后重试`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}：${txt.slice(0, 500)}`);
    return txt ? JSON.parse(txt) : null;
  }
}

if (!fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
  throw new Error(`public/ 里没有 index.html，先跑 hugo --minify --cleanDestinationDir`);
}

function walk(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else if (e.isFile()) out.push({ path: rel, abs: path.join(dir, e.name) });
  }
  return out;
}

const files = walk(PUBLIC_DIR);
const bytes = files.reduce((s, f) => s + fs.statSync(f.abs).size, 0);
console.log(`${OWNER}/${REPO} ← ${files.length} 个文件，${(bytes / 1048576).toFixed(1)} MB`);

const ref = await api("GET", `/git/ref/heads/${BRANCH}`);
const parentSha = ref.object.sha;
console.log(`${BRANCH} 当前：${parentSha.slice(0, 10)}`);

// 逐个建 blob（受限并发；blob 是内容寻址的，未变化的文件会自动复用，不产生新对象）
const entries = [];
let cursor = 0, done = 0;
async function worker() {
  while (cursor < files.length) {
    const f = files[cursor++];
    const blob = await api("POST", "/git/blobs", { content: fs.readFileSync(f.abs).toString("base64"), encoding: "base64" });
    entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    if (++done % 25 === 0 || done === files.length) console.log(`  blob ${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

// 键名必须是 tree。传成 entries 会得到 422 Invalid tree info
const tree = await api("POST", "/git/trees", { tree: entries });
console.log(`新树 ${tree.sha.slice(0, 10)}`);

// 提交前核对树上的文件与本地完全一致 —— 不一致就中止，宁可不动 master
const check = await api("GET", `/git/trees/${tree.sha}?recursive=1`);
const treeSet = new Set(check.tree.filter((t) => t.type === "blob").map((t) => t.path));
const localSet = new Set(files.map((f) => f.path));
const missing = [...localSet].filter((p) => !treeSet.has(p));
const extra = [...treeSet].filter((p) => !localSet.has(p));
if (missing.length || extra.length || check.truncated) {
  console.error(`❌ 树校验不通过：truncated=${check.truncated} 缺失=${missing.length} 多余=${extra.length}`);
  if (missing.length) console.error("  缺失：", missing.slice(0, 10).join(", "));
  if (extra.length) console.error("  多余：", extra.slice(0, 10).join(", "));
  console.error(`${BRANCH} 未做任何改动。`);
  process.exit(1);
}
console.log(`✓ 树校验通过：${treeSet.size} 个文件与本地一致`);

const message = process.argv[2] || `Deploy site: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
const commit = await api("POST", "/git/commits", { message, tree: tree.sha, parents: [parentSha] });
await api("PATCH", `/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
console.log(`✓ 已更新 ${BRANCH} → ${commit.sha.slice(0, 10)}`);
console.log("稍等一两分钟 GitHub Pages 生效。");
