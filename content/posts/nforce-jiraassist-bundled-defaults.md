---
title: "开箱就该能用：把两份配置装进插件"
slug: "nforce-jiraassist-bundled-defaults"
date: 2026-11-26T20:45:00+08:00
lastmod: 2026-11-26T20:45:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "workflow_steps.json 和 team_setup.csv 原来要人手动导入，不导入就什么都跑不起来。现在它们跟着插件一起发布，安装时就写进该去的地方——只写一次，且默认不启动定时器。"
showToc: true
---

这个插件有两份配置，一直是「用之前先导进来」：

- `workflow_steps.json`：定时分配那套规则
- `team_setup.csv`：Rebalance 的名单（谁属于哪条线、手上几张、偏好哪些模块）

结果是：装完插件打开定时分配页，空白；打开 Rebalance，没有组可选。**要先用的人得先当一次运维。**

这一版把两份文件装进插件，安装时自动写进它们该去的地方。

## 不是「读文件」，是「写一次」

关键选择：**不**让页面每次去读扩展目录里的文件，而是安装时把内容写进 storage，写进「本来导入会写的那两个位置」。

```js
await writeSchedule({ raw: text, source: 'workflow_steps.json', cron: BUNDLED_CRON, enabled: false, … });
await writeDataset({ id: 'bundled-team', kind: 'lookup', source: 'bundled', entries, attributes: ['team'] });
```

为什么绕这一下：

- 用户改过的规则要能存下来，而文件是只读的——两者必须落到同一个地方，否则「默认值」和「我的值」会分裂成两套读取路径。
- 导入出来的 dataset 和种子出来的 dataset 形状一致，Rebalance 的名单逻辑一行都不用改。
- 「文件里的」和「我导入的」只有一个区别：`source`。页面上能看出来。

## 「只写一次」是这份契约的全部

```js
if (!(await readSchedule())) { … }               // 已经有就不动
const already = datasets.some((d) => d?.source === 'bundled');
if (!already) { … }
```

这两个判断看起来像防御，其实它们是**这条功能唯一有风险的地方**：一次更新把用户调成 `0 9 * * 1-5` 的定时器重置回三分钟，或者把导入了 40 人的名单再插一份 13 人的进去，都是那种"上线三天后才有人发现"的事故。

所以两条断言写成了测试，也写成了变异：

- 「更新不会覆盖你改过的定时器」→ 把 `if (!record)` 改成 `if (true)` 必须让测试变红（它会）
- 「种子不会重复插入名单」→ 同上

变异测试在这里的价值不是覆盖率，而是**确认这两条防线真的连在电路上**。

## 默认值：三分钟，但不启动

播种的定时器是每 3 分钟（`*/3 * * * *`），而 `enabled` 是 `false`。

**默认值和默认行为是两件事。** 页面上会显示"每 3 分钟"，不用点保存；但定时器没被 arm，也没有 alarm。想让它真的跑，得点那个开关——而那个开关本来就会二次确认（「关掉」不需要确认，因为那是安全方向）。

一个安装完就自己往 Jira 写数据的默认值，不叫默认值，叫事故。

同理，第一次动它的正确方式是 **Dry run**：页面上的 `Run now` 和定时开关都在一次成功的 dry run 之前是禁用的。这条本来就存在，这次只是让它成为"开箱第一件事"。

## 名单得能被分组

那份 CSV 的列是 `Name, Key, Value, Preferred modules, Number of ticket on hand`。导入器把 `Value` 当成分组值（`PCD`），**但没有一列叫得出这个属性**——它的兜底是"用文件名当属性名"。

于是种子时把属性显式写成 `team`：

```js
const entries = parsed.entries.map((entry) => ({ ...entry, attribute: BUNDLED_TEAM_ATTRIBUTE }));
```

不写这一行，Rebalance 的下拉框会显示 `team-setup.csv — 13 person(s)`。能用，但没人知道自己在选什么。

## 顺带：悬浮按钮终于不用刷新了

Jira 是单页应用。从列表点进一张票，页面不重新加载——而那个「Assign · PCD · LTS · CVP7」按钮组是在脚本加载时判断"我现在是不是在工单页"的，于是它一直藏着，直到你按 F5。

`popstate` 只覆盖后退按钮，前进走 `history.pushState`，**什么都不触发**。所以两个方法都包一层，路由一变就重新判断；顺便检查宿主元素还在不在（有些视图会整块替换 body，把按钮一起扔掉）。

一个`window.__jiraAssistRouteHooked` 标记保证只包一次——每次挂载都包一层的话，一次点击会触发两遍、三遍。

## 结果

- 661 组断言（+2：安装即装好、更新不覆盖；都在真 worker + 真 HTTP 上跑）
- 299 个变异全部命中（+2：种子覆盖已存、种子自动 arm）
- `check` / `build` / `verify`（真 Chrome，十页）全绿——顺带把「全新安装没有任何导入数据」那条断言改成了「全新安装有且只有插件自带的那份名单」

版本 `v1.14.28`。
