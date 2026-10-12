// 把 content/posts/*.md 导出成可直接粘到外部平台的版本（掘金 / CSDN / 公众号 等）。
//
// 只做两件事，正文一个字都不改：
//   1. 去掉 Hugo front matter，把 title / summary 提到正文之前；
//   2. 把站内绝对路径的图片 `/post-images/…` 换成完整 URL，否则外部平台读不到图。
//
// 用法：node scripts/export-shares.mjs
// 每次改完文章重跑一遍，会覆盖 shares/ 下的全部文件 —— 不要手工编辑 shares/。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = path.join(ROOT, "content", "posts");
const OUT = path.join(ROOT, "shares");

// 站点地址从 hugo.toml 的 baseURL 读，避免和构建配置各写一份
const baseURL =
  (fs.readFileSync(path.join(ROOT, "hugo.toml"), "utf8").match(/^\s*baseURL\s*=\s*"([^"]+)"/m) || [])[1] ||
  "https://iamnicwu.github.io/";
const SITE = baseURL.replace(/\/+$/, "");

// 不导出的页面：建站存稿 / 说明页
const SKIP = new Set(["hello-world", "about"]);

/**
 * 解析 Hugo 的 YAML front matter。
 * 只处理本站实际用到的形态：`key: value`、双引号字符串、以及 `[a, b]` 行内数组；
 * 顶上带缩进的块（cover:）跳过 —— 导出用不到。刻意不引依赖，够用就行。
 */
function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line) || /^#/.test(line.trim())) continue;
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { data, body: raw.slice(m[0].length) };
}

// 站内绝对路径 → 完整 URL。Markdown 语法和正文里手写的 HTML 标签都要覆盖
const absolutize = (md) =>
  md
    .replace(/\]\((\/[^)\s]+)/g, (_, p) => `](${SITE}${p}`)
    .replace(/(\s(?:src|href)=")(\/[^"]*)"/g, (_, attr, p) => `${attr}${SITE}${p}"`);

// 正文里的 <figure class="post-figure …"> 是本站的排版载体，外平台支持不齐：
// 掘金会丢掉 class（限宽/居中失效），知乎直接不认 HTML，图注会连着一起消失。
// 所以统一降级成纯 Markdown —— 图 + 斜体图注，任何平台都能正确渲染。
const flattenFigures = (md) =>
  md.replace(
    /<figure[^>]*>\s*<img\s+([^>]*?)\/?>\s*(?:<figcaption>([\s\S]*?)<\/figcaption>\s*)?<\/figure>/g,
    (_, attrs, caption) => {
      const src = (attrs.match(/src="([^"]*)"/) || [])[1] || "";
      const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || "";
      const cap = caption ? caption.trim() : "";
      return `![${alt}](${src})` + (cap ? `\n\n*${cap}*` : "");
    }
  );

fs.mkdirSync(OUT, { recursive: true });

let n = 0;
for (const f of fs.readdirSync(POSTS).filter((f) => f.endsWith(".md")).sort()) {
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(POSTS, f), "utf8"));
  const slug = data.slug || path.basename(f, ".md");
  if (SKIP.has(slug) || data.draft === "true") continue;

  const tags = (Array.isArray(data.tags) ? data.tags : []).join(" · ");
  const canonical = `${SITE}/post/${slug}/`;

  fs.writeFileSync(
    path.join(OUT, `${slug}.md`),
    `# ${data.title}

> ${data.summary}

${flattenFigures(absolutize(body.trim()))}

---
${data.repo ? `\n**项目仓库**：${data.repo}\n\n---\n` : ""}
原文：[${data.title}](${canonical})${data.version ? ` · ${data.version}` : ""}
标签：${tags}
站内还写过几款同系列扩展，感兴趣可以顺着标签翻一翻。

<!-- 发布提示：图片已换成绝对地址 ${SITE}/post-images/…，需要先确认站点已部署到 GitHub Pages，否则图片会 404。 -->
`,
    "utf8"
  );
  n++;
  console.log(`✓ shares/${slug}.md`);
}

fs.writeFileSync(
  path.join(OUT, "README.md"),
  `# 各平台发布对照

导出脚本：\`node scripts/export-shares.mjs\`（每次改完文章重跑一遍，覆盖这里所有文件）

改动只发生在三处：front matter 被去掉、站内图片路径 \`/post-images/…\` 被替换成 \`${SITE}/post-images/…\`、
正文里的 \`<figure>\` 降级成「Markdown 图 + 斜体图注」。
文字一个字都没动 —— 所以这里的版本和博客上的是同一份内容。**改文章请改 \`content/posts/*.md\`，别改这里。**

## 平台适配速查

| 平台 | 直接粘 Markdown？ | 要注意的 |
| --- | --- | --- |
| 掘金 | 可以 | 支持 Markdown 与图片外链；封面在发布面板单独选，不会自动读第一张图 |
| CSDN | 可以 | 有「导入 Markdown」入口；外链图片首次加载会走它的防盗链代理，偶发加载慢属正常 |
| 知乎 | 不建议 | 编辑器对 Markdown 支持弱，表格和代码块容易散。建议先在掘金发完，再用「分享链接」贴过去 |
| 微信公众号 | 不行 | 公众号编辑器不吃 Markdown。用 mdnice 或 Doocs 的排版工具粘一遍，图片要重新上传到素材库 |
| 个人博客 | 不需要 | 直接改 \`content/posts/*.md\`，然后 \`hugo\` 重新构建 |
| 少数派 / InfoQ | 视栏目 | 一般是投递，正文按编辑要求重排 |

## 发布前检查

1. **站点已部署**。外部平台读的是 \`${SITE}/post-images/…\`，图片没推上去就是 404。先确认博客首页能打开、文章页图片正常。
2. **摘要**。所有平台都要单独填摘要，用 front matter 里的 \`summary\`，各平台保持一致。
3. **封面**。掘金和公众号要单独上传封面图，用 front matter 里 \`cover.image\` 指的那张。
4. **首发链接**。文章末尾已经带了原文链接，别删 —— 外部平台的流量能回到自己站点，靠的就是这一行。
`,
  "utf8"
);

console.log(`\n✓ 导出 ${n} 篇 → shares/`);
console.log(`  图片绝对地址前缀：${SITE}/post-images/`);
