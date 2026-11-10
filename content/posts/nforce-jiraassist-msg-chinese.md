---
title: "预览 .msg 时中文变成「ä½ å¥½」：一个被无视的属性"
slug: "nforce-jiraassist-msg-chinese"
date: 2026-11-10T11:30:00+08:00
lastmod: 2026-11-10T11:30:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "Outlook 的 .msg 里，中文字符串是 GBK 字节加一个「这些字节是 936」的属性。我读了一半——读了字节，没读那句说明。"
showToc: true
---

有人反馈：**.msg 预览里的中文全是乱码**，主题、正文、附件名，一整套。

乱码长这样：`ä½ å¥½`。看到这个形状就该认出原因——**UTF-8 的字节被当成 Latin-1 解了**。但这一次更具体：根本没人按 UTF-8 读，是「猜错了编码，而且猜错的那个编码永远不会失败」。

## .msg 里字符串有两种写法

Outlook 的邮件格式（MAPI）里，同一个字段可以存两份：

- `__substg1.0_0037001F` —— **Unicode**（`001F`），UTF-16LE，主题
- `__substg1.0_0037001E` —— **ANSI**（`001E`），单/多字节，主题

中文 Outlook 常写 ANSI 那份，字节是 GBK。那它怎么告诉阅读器「这是 GBK」？靠另一个属性：

```
__substg1.0_3FFD0003   ← PidTagMessageCodepage，值 936
```

**936 就是 GBK 的代码页号。** 一行说明，管全文。

我的读取器读了这个字节流，却没读这个属性——于是走了一条「UTF-8 试试，不行就 windows-1252」的路：

```js
try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
catch { return new TextDecoder('windows-1252').decode(bytes); }   // ← 这里
```

GBK 的中文字节通常不是合法 UTF-8，第一步失败，第二步 `windows-1252` 接手。而 **windows-1252 是一张单字节表，它没有任何字节序列会失败**——每个字节都能映射成某个带重音的拉丁字母。

于是「你好」（`C4 E3 BA C3`）变成 `ÄãºÃ` 这一类，而程序认为它读得很成功。

```
错的答案，恰好是那个不会报错的答案。
```

## 修法：先读那句话，再读字节

顺序变成四步，每一步对应一类真实邮件：

1. **声明的多字节代码页优先** —— 936→GBK、950→Big5、932→Shift-JIS、949→EUC-KR。这是邮件在说「我是什么」，没有理由不信。
2. **然后是 UTF-8**，即使声明的是单字节页。现代 Outlook 写 UTF-8 却常常不更新代码页，而 windows-1252 又不会失败——把它排在前面，就是「安静的错」的来源。
3. **再试声明的单字节页**（1250–1258 那些）。
4. **完全没声明**：UTF-8 → 看字节形状像不像双字节（连续高位字节成对出现）→ GB18030 → 最后才 1252。

第 4 步那个「像不像」是有代价的判断。写成这样：

```js
// 高位字节里，至少 80% 是成对的（GBK 双字节特征）才认作中文
return pairs > 0 && pairs * 2 >= high * 0.8;
```

`Café` 只有一个高位字节，成对数为 0，判为西欧文本；一整句 GBK 几乎全是成对字节，判为中文。这不是编码检测器，只是一个「别把巧合当成语言」的下限。

## 顺手修掉的三个小坑

**① HTML 正文有它自己的编码。** `PidTagHtml` 是二进制，中文 Outlook 写的是 GBK + `<meta charset=gb2312>`。原来无脑 `TextDecoder('utf-8')`，正文照样乱。现在先从前 2KB 里读 `charset`，读不到才回落到邮件的代码页。

**② 空的 Unicode 属性会遮住真的 ANSI 属性。** 判断写的是 `if (unicode)`——而空流的 `Uint8Array` 是**真值**。于是一封「Unicode 主题为空、ANSI 主题有值」的邮件，GBK 字节被当成 UTF-16 解：每两个字节一个字符，全错。改成 `if (unicode && unicode.length)`。

**③ HTML 实体里的中文。** 中文邮件客户端常写 `&#x4E2D;`（十六进制的「中」）。原来的实体解码只认 `&#123;` 这种十进制，还用了 `String.fromCharCode`（U+FFFF 以上直接错）。换成 `fromCodePoint` + 十六进制分支。

## 怎么验证的

测试夹具 `tests/msg-fixture.mjs` 本来就有一个**真的复合文件写入器**——不是 mock，是能产出合法 OLE2 结构的字节。我让它多写三种东西：ANSI 字符串、代码页属性、原始 HTML 字节。

于是断言是这样写的：

```js
const message = parseMsg(buildMsg({
  subjectAnsi: [0xC4, 0xE3, 0xBA, 0xC3],   // 真实 GBK 字节
  codepage: 936,
}));
assert.equal(message.subject, '\u4F60\u597D');
```

**字节是手写死的，不是「用编码器转一下再比对」**——Node 能解 GBK 但不能编 GBK，这反而正好：测的是读取器对上真实字节，而不是测我自己写的往返。

五个新断言：GBK 走代码页、GBK 无代码页靠形状兜底、空 Unicode 不遮 ANSI、HTML 的 `<meta>` 声明、实体与码点。

顺带一个副作用值得说：仓库有条规矩「任何随包源文件不得含 CJK 字符」，所以测试里的中文全部写成 `\uXXXX`。第一次跑就被这条守卫拦下来了——**守卫自己在工作**，这比它拦住了什么更重要。

## 还有一处不是编码问题

预览面板的正文用的是等宽字体栈：`ui-monospace, Menlo, Consolas, monospace`。纯英文邮件没问题，中英混排时中文会回落到系统给的某个 fallback，行高和西文对不上，读起来一跳一跳。

补上 CJK 字体族（`PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` / `Noto Sans CJK SC`），行高从 1.6 提到 1.7。这不是「支持中文」的必要条件，但它是「读起来不像将就」的那一半。

---

一个属性和一段猜测的距离，就是「能读中文」和「显示 ä½ å¥½」的距离。而这次真正的教训不是编码表——是**当两个方案一个会失败、一个永远不会失败时，先试那个会失败的**。会失败的那个才有信息量。
