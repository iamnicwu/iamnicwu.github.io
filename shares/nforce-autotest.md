# nForce AutoTest：一个插件形态的 Web 自动化测试工具

> Chrome 自动化测试扩展，装上就能用，不用配环境管 driver。用例可以手写，也可以边操作边录，跑完看每一步的结果和失败截图，还能导出成 Playwright 脚本放进 CI。

做内部系统，改完总要手动点一遍才放心。装 Selenium 或者 Playwright 又有点重：环境要配，driver 要管，团队里不写代码的同事基本用不起来。

nForce AutoTest 换了个做法，用浏览器扩展做测试。装上就能用，不用 npm install，也不用管 driver。它跑在你已经登录的浏览器里，省掉了登录这一步。

![nForce AutoTest 图标](https://blog.nickwu.fun/post-images/nforce-autotest/00-icon.png)

*图标是机器人头 —— nForce 系列里闪电已经被 Tools 占了，自动化就用了机器人*

顺带说下配色：nForce 系列的品牌渐变是 `#06B6D4 → #3B82F6 → #7C3AED`，四款扩展共用这一套。

## 两条产出用例的路

### 手写：表格化编辑

控制台左侧是用例列表，右侧是步骤表格。每行一个动作，下拉框选动作类型，填目标元素和值。跑整个流程按一下「运行此用例」。

内置了一份示例用例（`examples/demo-cases.json`），装上就能跑，先看结果长什么样再决定要不要自己写。

### 录制：正常操作页面

控制台右上角点「● 录制用例」，然后在打开的标签页里正常操作 —— 点击、输入、选下拉、勾选、跳页。步骤会实时出现在控制台里，点「■ 停止并保存用例」就生成一条可用例。

**录制时被测页面底部会出现一条悬浮控制条**，红点 + 已捕获步数 + 「■ 结束并保存」/「✕ 放弃」。这是被真实使用场景逼出来的设计：一开始停止按钮只在控制台里，但用户录的时候焦点在被测页面 —— 操作完根本找不到结束的按钮。把停止入口放到眼前，问题就没了。

录制处理了几个容易出错的地方：

- 支持 `<div>` / `<span>` 这类**伪按钮**（现代前端框架里到处都是），不只认 `<button>` 和 `<a>`。
- 输入**不需要失焦**，停止输入大约 0.6 秒后自动记录。
- **密码框不会明文记录**，存成 `******`（运行前需要在编辑器里填回真值）。
- 同一输入框连续修改只保留最后一次。
- 页面跳转自动记成 `goto` 步骤，跳转后录制继续生效。
- 悬浮条自己的点击不会被录进用例 —— 捕获监听里先判断事件目标是不是控制条本身。

## 用例是什么

一条用例就是一个 JSON，可以直接导入导出：

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

`delayMs` 是步骤之间的缓冲延迟（默认 150ms），给 SPA 渲染留点时间，降低时序类 flake。设成 `0` 可以关掉。

运行过程中工具栏的「运行全部」会变成「■ 停止运行」，点了会在当前步骤执行完之后中止 —— 而不是硬切断留一个半死不活的页面。

### 目标选择器支持四种写法

| 写法 | 含义 | 例子 |
| --- | --- | --- |
| `css=xxx` 或裸写 | CSS 选择器 | `css=button.primary`、`#login` |
| `id=xxx` | 按 id 匹配 | `id=username` |
| `text=xxx` | 按可见文本匹配（优先挑可交互元素） | `text=登录` |
| `xpath=xxx` | XPath | `xpath=//a[@href='/home']` |

`text=` 这个在实际用的时候最省事 —— 页面上「登录」两个字可能同时出现在按钮和标题里，按可见文本找会优先挑按钮。

### 内置动作

| 分组 | 动作 |
| --- | --- |
| 页面 | `goto` `refresh` `back` `forward` `screenshot` |
| 交互 | `click` `dblclick` `input` `clear` `pressKey` `select` `check` `uncheck` `hover` `scroll` |
| 等待 | `wait`（固定毫秒） `waitFor`（等元素出现，可设超时） |
| 断言 | `assertText` `assertValue` `assertVisible` `assertHidden` `assertUrl` `assertTitle` `assertCount` |
| 高级 | `eval`（在页面里执行自定义异步 JS） |

运行规则很直白：**遇到失败自动截图留证，后续步骤标记为「跳过」**。不继续往下跑，是因为后面的步骤大概率会连环报错，一堆红色反而看不出真正的问题在哪。

## iframe 也能测

录制和回放都支持 iframe 里的元素，这块做的时候踩了不少坑：

- 录制时记下该步骤所属的 frame（层级索引 + URL），存进用例的 `_frame` 字段。跨域 iframe 也能读 `parent.frames[i] === window` 做索引比较。
- 回放时用 `chrome.webNavigation.getAllFrames()` 先按 URL 精确匹配、再按路径索引匹配，解析出 frameId 再精确派发消息。
- **派发消息时必须显式带 frameId。** 不带的话广播会被任意 frame 抢答，所以这里没有任何回退空间。也正因为带了 frameId，才敢把之前用来防串台的 `if (window !== window.top) return false` 保护去掉 —— 不然 iframe 里的步骤根本执行不了。
- 页面结构变了匹配不到 frame 时，退回主框架执行并在报告里报错，而不是静默跳过。

## 导出成 Playwright 脚本

这是我觉得整个项目里最有价值的一块。

插件形态有个绕不过的硬约束：**上不了 CI**。它需要桌面 Chrome，MV3 的 Service Worker 闲置 30 秒就被回收，单浏览器串行跑不了并行 —— 这些都是架构性的，改不掉。

但那不代表它没价值，只是位置不同：**插件负责产出用例，Playwright 负责执行**。所以用例编辑页加了个「导出脚本」按钮，直接把 JSON 转成能 `pytest` 跑的 Python：

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

顺带解释一下为什么当时选了 Playwright 而不是 Selenium：新项目基本没有理由再用纯 Selenium 了 —— 免 driver 版本管理、时序类 flake 少得多、单测跑得快。Selenium 现在的主要价值在多语言绑定和 Appium / 遗留浏览器那些场景。

## 加一个新动作只要一个条目

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

涉及导航、截图的**页面级动作**再加一个 `tab: true`，然后在 `editor/runner.js` 的 `NF.TAB_ACTIONS` 里实现。选择器辅助函数（`findElement` / `setValue` / `isVisible` / `buildSelector`）都在 `lib/selector.js`。

注册表的写法是刻意的 —— 动作是这类工具唯一会持续增长的东西，让它扩展起来只改一个文件，比后期写文档省事。

## 目录结构

```
├── manifest.json              # MV3 清单
├── background/service-worker.js   # 录制会话管理、导航记录、跨页重挂录制
├── content/content-script.js      # 页面内执行步骤 + 捕获用户操作
├── lib/
│   ├── selector.js            # 选择器解析 / 定位 / 生成
│   └── actions.js             # ★ 动作注册表（核心扩展点）
├── editor/
│   ├── editor.html/css/js     # 控制台：用例管理、步骤编辑、录制面板、结果汇总
│   └── runner.js              # 用例运行器
├── popup/                     # 工具栏弹窗
└── examples/demo-cases.json   # 可导入的示例用例
```

权限只要四个：`storage`、`unlimitedStorage`、`tabs`、`scripting`、`webNavigation`，加上 `http://*/*` 和 `https://*/*` 的 host 权限（测试工具必须能注入任意站点，这条避不开）。

`unlimitedStorage` 是被逼出来的：失败截图存成 dataURL，很容易撑爆默认的 10MB 配额。加了这个权限之后安装提示会多一行，但测试工具的目标用户本来就清楚它要干什么，可以接受。

## 安装

1. `chrome://extensions/` → 打开开发者模式
2. 加载已解压的扩展程序 → 选仓库根目录
3. 工具栏出现 ⚡ 图标
4. 点图标 → 「🧪 打开测试控制台」，左边选示例用例 → 「▶ 运行此用例」

## 已知限制

- 录制**不覆盖** hover、拖拽、双击 —— 这三个在浏览器里没有可靠的捕获信号，需要手动在编辑器里补步骤。
- iframe 支持了，但嵌套过深或者 frame URL 每次动态变化的页面可能匹配不到，会退回主框架并在报告里报错。
- `chrome://`、Chrome 商店这类受限页面无法注入和录制。
- 密码录制为掩码，运行前要手动填回真实密码 —— 这是有意的，明文密码写进 JSON 用例里是个坑。
- 截的是**可视区域**，不是整页。
- `eval` 动作受页面 CSP 限制，开了 `unsafe-eval` 限制的站点会失败。

## 小结

这个东西的定位一开始想错了，我本来想让它替代 Selenium。做了一半发现不对：它跟 Playwright 不在同一条链路上竞争。**插件赢在用例产出**（录制、复用已登录会话、零环境门槛），**Playwright 赢在执行与规模化**（无头 CI、并行分片、网络 mock）。

想清楚之后方向就顺了：不跟 Playwright 抢执行，把自己做成它的上游 —— 录制出来的用例导出成脚本，CI 里跑。工具的边界在哪，比它有多少功能重要得多。

代码在 [github.com/iamnicwu/nForce-autoTest](https://github.com/iamnicwu/nForce-autoTest)。

---

**项目仓库**：https://github.com/iamnicwu/nForce-autoTest

---

原文：[nForce AutoTest：一个插件形态的 Web 自动化测试工具](https://blog.nickwu.fun/post/nforce-autotest/) · v1.0.0
标签：Chrome 扩展 · 自动化测试 · 开发工具
站内还写过几款同系列扩展，感兴趣可以顺着标签翻一翻。

<!-- 发布提示：图片已换成绝对地址 https://blog.nickwu.fun/post-images/…，需要先确认站点已部署到 GitHub Pages，否则图片会 404。 -->
