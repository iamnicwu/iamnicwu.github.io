---
title: "nForce Translate v1.12.0：AI 模型和润色可以直接接中转站"
slug: nforce-translate-v1120
date: 2026-11-14T22:32:29+08:00
lastmod: 2026-11-14T22:32:29+08:00
draft: false
tags: ["Chrome 扩展", "翻译工具", "效率工具"]
repo: "https://github.com/iamnicwu/nForce-translate"
version: "v1.12.0"
summary: "填中转站给的地址就行——完整的 /chat/completions 不会再被拼第二次，认证方式能换 api-key，还能加自定义请求头。翻译和润色各填各的。"
showToc: true
---

以前「AI 模型」和「润色模型」只认标准 OpenAI 写法：地址填到 `/v1`，认证固定 `Authorization: Bearer`。中转站（one-api、new-api、各种代理网关）经常不是这个规矩，于是最常见的两个坑：

1. 把中转站给的**完整地址**粘进去 → 变成 `.../chat/completions/chat/completions` → 404
2. 网关要 `X-Api-Key` 或 `api-key` 头 → 401，但错误提示只说「Key 无效」，看不出问题在哪

这一版都处理了。

## 三处改动

**接口地址两种写法都认**
填 `/v1` 会自动补 `/chat/completions`；填完整路径就原样用，不会再拼一次。`?api-version=2024-02-01` 这种查询参数会保留（Azure 风格的网关要用）。

**认证方式可选**
默认还是 `Authorization: Bearer`，多了一个 `api-key` 头——Azure OpenAI 和一部分中转网关只认这个。

**自定义请求头**
收在「高级」折叠里，一行一个 `Key: Value`。要 `X-Api-Key`、`HTTP-Referer`、`X-Title` 这类头时填这里；留空就是标准 Bearer。翻译和润色是两个独立的中转也没问题，各填各的。

## 报错也不再糊

以前 401 只有一句「API Key 无效或没有权限」。现在按状态码分开说：

| 状态 | 提示 |
| --- | --- |
| 401 / 403 | Key 无效、额度用尽，**或这个中转站不认这种认证方式**（可以换 api-key 头） |
| 404 | **接口地址可能不对**：`/v1` 和完整 `.../chat/completions` 都行，但路径要和服务商文档一致 |
| 429 | 被限流或额度用尽，看一眼中转站余额 |
| 5xx | 中转站或服务端出错 |

400 会把服务端返回的那句话带出来——模型名写错、参数不支持这类问题，一看就知道。

## 验证

- 单测 110 项：地址拼接（含 Azure 路径与查询参数）、请求头解析、两种认证、状态码文案、以及一个假 fetch 的端到端（完整地址 + api-key + 自定义头）
- 真机 80 项：把润色指向本地假接口，按中转站填法配置（完整地址 + `api-key` + `X-Relay-Test`），断言请求真的落在 `/v1/chat/completions`、头也带过去了
