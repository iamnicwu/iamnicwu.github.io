---
title: "一次点击该做几件事"
slug: "nforce-jiraassist-pcd-recipe"
date: 2026-11-25T21:00:00+08:00
lastmod: 2026-11-25T21:00:00+08:00
draft: false
tags: ["Chrome 扩展", "Jira", "工程实践", "nForce"]
summary: "工单页上的「分配 PCD」原来只是照着 workflow 改个负责人。现在它要做三件事：加两个 label、换负责人、流转到 Under Investigation。三步的顺序和「第几步失败就停」比三个接口调用重要得多。"
showToc: true
---

工单页右下角那三个按钮（PCD / LTS / CVP7）原来做一件很窄的事：从 `workflow_steps.json` 里找到同名的步骤，把它的 `assignee` 写进这张票。

PCD 不一样。PCD 是一套固定的动作：

1. 加两个 label：`Netvigator_Related`、`js_auto_script`
2. 负责人改成 PCD 的那个人
3. 流转到 `Under Investigation`

**一次点击，三个写操作。** 这篇讲的是那三个操作之间的约束——它比"调三个接口"难的部分全在约束里。

## 为什么顺序不能换

三个操作各自幂等，但它们组合起来的中间态不幂等。

如果先流转再分配：票已经变成 `Under Investigation`，看上去已经有人在处理了，但实际上没有负责人。**这张票会在看板上消失**——所有"谁在做什么"的视图都是按负责人聚合的，没有负责人的票不在任何人的列表里。发现它的唯一方式是哪天有人问"这张票谁在跟"。

如果先分配再流转：名单上有人接了这张票，但状态还是新的，下一个人可能又看一遍。

所以顺序是：**标记 → 定人 → 流转**。标记（labels）先做，是因为它描述"这张票属于哪条线"，与人无关；人是中间的传递状态；流转是收尾。

## 中间失败必须停

第二个约束：**任何一步失败，后面的不许跑。**

```js
try {
  const current = await getIssueFields(settings, issueKey, ['labels']);
  const existing = Array.isArray(current?.labels) ? current.labels : [];
  const missing = recipe.labels.filter((label) => !existing.includes(label));
  if (missing.length) await updateIssue(settings, issueKey, { labels: [...existing, ...missing] });
  results.push({ step: 'labels', ok: true, detail: ... });
} catch (err) {
  results.push({ step: 'labels', ok: false, error: ... });
  return { results, stopped: 'labels' };   // ← 关键
}
```

"继续执行"在这里是错的：labels 写入被权限拒掉、但负责人的写成功了，你会得到一张**挂着 PCD 的负责人、却没打上 PCD 标记的票**——两边都不对，而且没人知道它是什么状态。

失败时返回的结构也留了证据：

```
PCD stopped at labels
  hint: You do not have permission to edit labels.
  detail: labels: failed
```

页面上的状态行显示 `stopped at labels`，而不是一个 "failed"。一个写入说 "failed" 等于什么都没说。

## labels 是合并，不是覆盖

这一条差点写错。直觉写法是：

```js
await updateIssue(settings, key, { labels: ['Netvigator_Related', 'js_auto_script'] });
```

Jira 的字段写是**替换**语义。这么写会把这张票上别人的 label 全部清掉——比如另一个人标的 `regression`、`customer-escalation`，无声消失。

所以先读再并：

```js
const current = await getIssueFields(settings, issueKey, ['labels']);
const existing = current?.labels ?? [];
const missing = recipe.labels.filter((label) => !existing.includes(label));
if (missing.length) await updateIssue(settings, issueKey, { labels: [...existing, ...missing] });
```

`getIssueFields` 这个函数在这个仓库里早就有了，注释里写着它的用途：「`add` 和 `remove` 是相对操作，需要知道当前值；把读不到当成空数组，就是一个脚本悄悄删掉别人 label 的方式」。这次正好用上。

顺带：`if (missing.length)` 不是省事，是**幂等**——重复点同一个按钮不该产生一次写请求，也不该失败。

## 为什么 PCD 在代码里，另外两个在文件里

`workflow_steps.json` 里既有规则也有动作，LTS 和 CVP7 继续走它：改归属人是改文件，不用发版。

PCD 不走。它的三个值（两个 label、一个人、一个目标状态）是一次**决定**，不是一份**配置**。区别在于：配置会随排班变，决定要经过讨论才变。所以它写进代码，配一段注释说清顺序和为什么停。

```js
const MODULE_RECIPES = {
  PCD: {
    labels: ['Netvigator_Related', 'js_auto_script'],
    assignee: '82017576',
    transition: 'Under Investigation',
  },
};
```

这个不对称是故意的：**会变的进文件，不会变的进代码，且都要写注释说明自己是哪一种。**

## 流转名要按"现在能做什么"匹配

`Under Investigation` 不是一个可以硬编码的 transition id。Jira 的流转列表是按工作流、按当前状态算的——同一张票在"新建"和在"处理中"，可用的流转不同。

所以走的是既有的两步：`getTransitions(issue, key)` 拿到此刻可用的列表，再用 `matchTransition(list, 'Under Investigation')` 按名字或目标状态名匹配（大小写不敏感）。匹配不到时，错误里带上**这次可用的名字**：

```
Available here: Start Progress, Investigate, Waiting for customer
```

这条 hint 是给下一个人的：他看到的是"这里能做什么"，而不是"你拼错了"。

## 结果

- 658 组断言（+1：三步顺序、labels 合并、失败即停、坏 key 不进 Jira）
- 296 个变异全部命中（+2：跳过 PCD 配方、失败后继续执行）
- `check` / `build` / `verify`（真 Chrome，十页）全绿

版本 `v1.14.25`。
