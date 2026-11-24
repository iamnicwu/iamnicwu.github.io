---
title: "那个角标是你选的位置，不是页面的"
slug: "nforce-jiraassist-drag-launcher"
date: 2026-11-24T12:20:00+08:00
lastmod: 2026-11-24T12:20:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "一个固定在右下角的按钮，在某些 Jira 页面上正好压在评论框上，在另一些上压住页脚。现在它能被拖动，而且记住你放的地方——位置存的是离右下的距离，不是左上坐标。"
showToc: true
---

扩展在 Jira 页面右下角钉了一个圆形按钮，点开是四个常用页面。位置是写死的：

```css
.jl-wrap { position: fixed; right: 20px; bottom: 20px; }
```

问题在于「右下角」不是一个固定的东西。工单页右下角是评论框，「创建」页右下角是页脚按钮，看板页右下角什么都可能是。同一个坐标，在三种页面上压在三种东西上。

所以现在它能拖，而且记住被放在哪。

## 存什么坐标，决定了它会不会乱跑

直觉是存 `left` 和 `top`。这个直觉在这里是错的。

按钮和它的菜单在同一个容器里，菜单从按钮**向上**展开：

```css
.jl-wrap { display: flex; flex-direction: column; align-items: flex-end; }
```

容器里有菜单和按钮，菜单在上、按钮在下。如果把容器钉在 `top`，**每次打开菜单，按钮就会被菜单推着往下走**——点一次动一次，像个不肯站住的图钉。

所以存的是离**右下角**的距离：

```css
.jl-wrap[data-dragged='1'] {
  right: var(--jl-right, 20px);
  bottom: var(--jl-bottom, 20px);
}
```

按钮是容器的最后一个子元素、贴着底边，所以 `right`/`bottom` 指的是按钮自己的那个角。菜单往上长多少都跟它无关。

一行 CSS 的选择，背后是「谁在长、谁必须不动」的判断。

## 夹取：存下来的位置必须在任何窗口里都还在

存进去的数字会有机会错：宽屏上拖到右边，换到笔记本上打开，那个 `right` 可能是 `-300`——按钮跑到屏幕外，而且没有任何办法把它弄回来。

所以有一个纯函数，写死在门禁里：

```js
export function clampLauncher(position = {}, viewport = {}, size = {}, margin = 8) {
  const limitRight  = Math.max(margin, vw - width - margin);
  const limitBottom = Math.max(margin, vh - height - margin);
  // 夹到 [margin, limit]
}
```

四种情况各有断言：

| 情况 | 期望 |
|---|---|
| 拖到正常位置 | 原样保存 |
| 拖出边缘 | 停在 8px，不落盘到屏幕外 |
| 宽屏存、窄屏读 | 拉回可见区域 |
| 窗口比按钮还小 | 仍然给出一个可用角落 |
| 存的是 `'x'` / `null` / 空对象 | 回到默认角落，不是 `NaN` |

这条函数是纯的，所以这些断言不需要浏览器。**会飞出去的坐标，靠手拖是测不出来第二、三行的。**

## 拖和点的分界：4 像素

按钮的主职责是「点开菜单」，现在多了「拖动」。两者共用一个手势，所以要有阈值：

```js
if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
```

不到 4 像素不算拖——手抖着点一下，不能被当成拖动，否则按钮用起来像坏了。

超过 4 像素就进入拖动态；松手时把「刚才是拖」记下来，紧接着的那个 `click` 直接吃掉：

```js
fab.addEventListener('click', (event) => {
  if (lastDrag) { lastDrag = false; event.preventDefault(); return; }
  setOpen(menu.hidden);
});
```

`pointerup` 之后浏览器照样会派发 `click`。不吞掉它，拖完手一松，菜单就弹开了——用起来像「拖一下就自动打开」。

另外两件小事：`touch-action: none`（不然触屏上拖动会变成滚页面），以及按下就关菜单（拖着一个展开的菜单跑，视觉上很吵）。

## 写权限：白名单从 1 条变成 3 条

上一版给消息通道加了发送者校验，内容脚本只许读附件：

```js
const CONTENT_ALLOWED = new Set(['ATTACHMENT_MSG']);
```

这次需要它写一个位置——内容脚本跑在别人的页面上，扩展的 `chrome.storage` 又对内容脚本关闭（`setAccessLevel('TRUSTED_CONTEXTS')`），所以位置必须由 worker 代存。

于是白名单变成三条，其中**两条是新增的写**：

```js
const CONTENT_ALLOWED = new Set([
  'ATTACHMENT_MSG',      // 读
  'LAUNCHER_POS_GET',    // 读
  'LAUNCHER_POS_SET',    // 唯一的写
]);
```

这条写不是「信任页面」，而是「接受两个整数然后自己夹」：

```js
if (!Number.isFinite(x) || !Number.isFinite(y)) throw new JiraError('That is not a position', …);
if (x < 0 || y < 0 || x > 20000 || y > 20000) throw new JiraError('That position is outside any window', …);
```

为什么值得开这个口子：一个位置存进坏值，会让按钮**在每一个 Jira 页面上都消失**，而用户唯一的修法是清扩展数据。所以这一处宁可报错。

顺带，守卫的测试也长了一条：同一个内容脚本发 `CATEGORISE_APPLY` 依然被拒——白名单是三条具体的消息，不是「页面脚本可以写」。

## 结果

- 656 组断言（+2：夹取的五种情况、位置的存取与拒绝）
- 291 个变异全部命中（+2：去掉夹取、去掉越界检查）
- `check` / `build` / `verify`（真 Chrome，十页 + 角标启动器）全绿

版本 `v1.14.23`。
