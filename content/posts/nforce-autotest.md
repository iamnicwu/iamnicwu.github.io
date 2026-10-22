---
title: "nForce AutoTest：一个插件形态的 Web 自动化测试工具"
slug: nforce-autotest
date: 2026-10-12
lastmod: 2026-10-22
draft: false
tags: ["Chrome 扩展", "自动化测试", "开发工具"]
# repo / version 供 scripts/export-shares.mjs 生成外平台稿件时取用。
# 改版本号时记得同步 content/projects.md 里的徽章。
repo: "https://github.com/iamnicwu/nForce-autoTest"
version: "v1.0.0"
summary: "Chrome 自动化测试扩展，装上就能用，不用配环境管 driver。用例可以手写，也可以边操作边录，跑完看每一步的结果和失败截图，还能导出成 Playwright 脚本放进 CI。"
showToc: true
cover:
  # 项目里只有 256x256 的方形图标，直接当列表缩略图会被裁掉大半，
  # 所以合成了这张 1200x675 的品牌横幅（品牌渐变底 + 居中图标）
  image: "/post-images/nforce-autotest/00-cover.jpg"
  alt: "nForce AutoTest 品牌横幅"
  hiddenInSingle: true
  relative: false
---

做内部系统，改完总要手动点一遍才放心。装 Selenium 或者 Playwright 又有点重：环境要配，driver 要管，团队里不写代码的同事基本用不起来。

nForce AutoTest 换了个做法，用浏览器扩展做测试。装上就能用，不用 npm install，也不用管 driver。它跑在你已经登录的浏览器里，省掉了登录这一步。

<figure class="post-figure is-icon"><img src="/post-images/nforce-autotest/00-icon.png" alt="nForce AutoTest 图标" width="140" height="140"><figcaption>图标是机器人头。nForce 系列里闪电已经被 Tools 占了，自动化就用了机器人</figcaption></figure>

nForce 系列的品牌渐变是 `#06B6D4 → #3B82F6 → #7C3AED`，四款扩展共用这一套。

## 两条做用例的路

### 手写

控制台左侧是用例列表，右侧是步骤表格。每行一个动作，下拉框选动作类型，填目标元素和值。跑整个流程按一下「运行此用例」。

内置了一份示例用例（`examples/demo-cases.json`），装上就能跑。先看看结果长什么样，再决定要不要自己写。

### 录一遍

控制台右上角点「● 录制用例」，然后在打开的标签页里正常操作：点击、输入、选下拉、勾选、跳页。步骤会实时出现在控制台里，点「■ 停止并保存用例」就生成一条用例。

录制时被测页面底部会出现一条悬浮控制条，红点、已捕获步数，加上「■ 结束并保存」和「✕ 放弃」。一开始停止按钮只在控制台里，可录的时候焦点在被测页面，操作完根本找不到结束的按钮。后来把入口挪到了眼前。

录制处理了几个容易出错的地方：

- 支持 `<div>` / `<span>` 这类伪按钮（现代前端框架里到处都是），不只认 `<button>` 和 `<a>`。
- 输入不需要失焦，停止输入大约 0.6 秒后自动记录。
- 密码框不会明文记录，存成 `******`。运行前需要在编辑器里填回真值。
- 同一输入框连续修改只保留最后一次。
- 页面跳转自动记成 `goto` 步骤，跳转后录制继续生效。
- 悬浮条自己的点击不会被录进用例。

## 一条用例就是一个 JSON

用例可以直接导入导出：

```json
{
  "name": "登录流程",
  "delayMs": 150,
  "steps": [
    { "action": "goto", "value": "https://the-internet.herokuapp.com/login" },
    { "action": "input", "target": "#username", "value": "tomsmith" },
    { "action": "input", "target": "#password", "value": "SuperSecretPassword!" },
    { "action": "click", "target": "css=button[type=submit]" },
    { "action": "assertUrl", "value": "/secure" }
  ]
}
```

`delayMs` 是步骤之间的缓冲延迟，默认 150ms，给 SPA 渲染留点时间，减少时序类的 flake。设成 `0` 可以关掉。

运行过程中工具栏的「运行全部」会变成「■ 停止运行」。点了会在当前步骤执行完之后中止，不会硬切断，留一个半死不活的页面。

### 选择器有四种写法

| 写法 | 含义 | 例子 |
| --- | --- | --- |
| `css=xxx` 或裸写 | CSS 选择器 | `css=button.primary`、`#login` |
| `id=xxx` | 按 id 匹配 | `id=username` |
| `text=xxx` | 按可见文本匹配（优先挑可交互元素） | `text=登录` |
| `xpath=xxx` | XPath | `xpath=//a[@href='/home']` |

`text=` 实际用起来最省事。页面上「登录」两个字可能同时出现在按钮和标题里，按可见文本找会优先挑按钮。

### 能做什么动作

| 分组 | 动作 |
| --- | --- |
| 页面 | `goto` `refresh` `back` `forward` `screenshot` |
| 交互 | `click` `dblclick` `input` `clear` `pressKey` `select` `check` `uncheck` `hover` `scroll` |
| 等待 | `wait`（固定毫秒） `waitFor`（等元素出现，可设超时） |
| 断言 | `assertText` `assertValue` `assertVisible` `assertHidden` `assertUrl` `assertTitle` `assertCount` |
| 高级 | `eval`（在页面里执行自定义异步 JS） |

遇到失败会自动截图留证，后续步骤标记为「跳过」。不继续往下跑，是因为后面的步骤大概率连环报错，一片红反而看不清真正的问题。

## iframe 也能测

录制和回放都支持 iframe 里的元素，这块做的时候踩了不少坑：

- 录制时记下该步骤所属的 frame（层级索引 + URL），存进用例的 `_frame` 字段。跨域 iframe 也能读 `parent.frames[i] === window` 做索引比较。
- 回放时用 `chrome.webNavigation.getAllFrames()` 先按 URL 精确匹配、再按路径索引匹配，解析出 frameId 再精确派发消息。
- 派发消息时必须显式带 frameId。不带的话广播会被任意 frame 抢答，这里没有回退空间。也因为带了 frameId，才敢把之前防串台的 `if (window !== window.top) return false` 去掉。留着的话，iframe 里的步骤根本执行不了。
- 页面结构变了匹配不到 frame 时，退回主框架执行，并在报告里报错。

## 导出成 Playwright 脚本

插件形态有个绕不过去的限制：上不了 CI。它要桌面 Chrome，MV3 的 Service Worker 闲置 30 秒就回收，单浏览器也没法并行。这些都是结构性的，改不掉。

所以我给用例编辑页加了个「导出脚本」按钮，把 JSON 转成能 `pytest` 跑的 Python。插件负责产出用例，执行交给 Playwright：

```python
def test_example_com(page: Page):
    page.goto("https://example.com")
    expect(page.locator("h1")).to_contain_text("Example Domain")
    page.get_by_text("More information...").click()
    expect(page).to_have_url(re.compile("iana.org"))
```

映射规则：

| 插件动作 | Playwright (Python) |
| --- | --- |
| `goto` / `refresh` / `back` / `forward` | `page.goto()` / `reload()` / `go_back()` / `go_forward()` |
| `click` / `dblclick` / `hover` | `locator.click()` / `dblclick()` / `hover()` |
| `input` / `clear` | `locator.fill(v)` / `fill("")` |
| `select` / `check` / `uncheck` | `select_option(v)` / `check()` / `uncheck()` |
| `wait` / `waitFor` | `wait_for_timeout(ms)` / `expect(loc).to_be_visible(timeout=)` |
| `assertText` / `assertValue` | `expect(loc).to_contain_text(v)` / `to_have_value(v)` |
| `assertVisible` / `assertHidden` | `expect(loc).to_be_visible()` / `to_be_hidden()` |
| `assertUrl` / `assertTitle` / `assertCount` | `expect(page).to_have_url(...)` / `to_have_title(...)` / `to_have_count(n)` |
| `screenshot` / `eval` | `page.screenshot(path=...)` / `page.evaluate(...)` |

选择器也会翻译成惯用写法：`text=登录` → `get_by_text("登录")`，`[data-testid="x"]` → `get_by_test_id("x")`，`id=a` / `css=a` → `locator("#a")` / `locator("a")`。

选 Playwright 不选 Selenium，是因为新项目基本没有理由再用纯 Selenium：不用管 driver 版本，时序类的 flake 少很多，单测也跑得快。Selenium 现在的价值主要在多语言绑定和 Appium、遗留浏览器这些场景。

## 加动作只改一个文件

所有动作集中注册在 `lib/actions.js` 的 `NF.ACTIONS` 里。加一个条目，编辑器下拉框、录制、运行、结果展示会全部自动认出来：

```js
// 例：新增「右键」动作
rightClick: {
  label: "右键", group: "交互",
  fields: { target: true, value: null },
  desc: "派发 contextmenu 事件",
  run: async (ctx) => {
    const el = NF.findElement(ctx.target);
    NF.scrollIntoView(el);
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }
}
```

涉及导航、截图的页面级动作再加一个 `tab: true`，然后在 `editor/runner.js` 的 `NF.TAB_ACTIONS` 里实现。选择器辅助函数（`findElement` / `setValue` / `isVisible` / `buildSelector`）都在 `lib/selector.js`。

动作是这类工具唯一会持续增长的东西。扩展的时候只改一个文件，比后期补文档省事。

## 权限

`storage`、`unlimitedStorage`、`tabs`、`scripting`、`webNavigation` 五个，加上 `http://*/*` 和 `https://*/*` 的 host 权限。测试工具必须能注入任意站点，这条避不开。

`unlimitedStorage` 是被逼的。失败截图存成 dataURL，很容易撑爆默认的 10MB 配额。加了它安装提示会多一行，不过用测试工具的人一般清楚它要干什么。

## 安装

1. `chrome://extensions/` → 打开开发者模式
2. 加载已解压的扩展程序 → 选仓库根目录
3. 工具栏出现 ⚡ 图标
4. 点图标 → 「🧪 打开测试控制台」，左边选示例用例 → 「▶ 运行此用例」

## 已知限制

- 录制不覆盖 hover、拖拽、双击。这三个在浏览器里没有可靠的捕获信号，需要手动在编辑器里补步骤。
- iframe 支持了，但嵌套过深或者 frame URL 每次动态变化的页面可能匹配不到，会退回主框架并在报告里报错。
- `chrome://`、Chrome 商店这类受限页面无法注入和录制。
- 密码录制为掩码，运行前要手动填回真实密码。明文密码写进 JSON 用例里是个坑。
- 截的是可视区域，不是整页。
- `eval` 动作受页面 CSP 限制，开了 `unsafe-eval` 限制的站点会失败。

## 小结

定位一开始就想错了。我本来想让它替代 Selenium，做了一半发现不对：它跟 Playwright 不在同一条链路上。插件擅长把用例产出来，录制、复用已登录的会话、不用配环境；Playwright 擅长执行，无头 CI、并行分片、网络 mock 都是它的事。

想清楚之后方向就顺了：不跟 Playwright 抢执行，把自己做成它的上游。录出来的用例导成脚本，放到 CI 里跑。

代码在 [github.com/iamnicwu/nForce-autoTest](https://github.com/iamnicwu/nForce-autoTest)。
