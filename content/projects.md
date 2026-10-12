---
title: "项目"
url: "/projects/"
summary: "写过的 Chrome 扩展与内部工具"
description: "四款 nForce 系列 Chrome 扩展，以及它们各自的介绍文章，全部开源在 GitHub。"
---

这些都是围绕「在浏览器里把活干完」这条线做出来的东西。每一款都配了一篇写了取舍和踩坑过程的介绍，代码在 GitHub 上。

<div class="project-grid">

<article class="project-card">
  <a class="project-cover" href="{{< relref "posts/nforce-tools.md" >}}"><img src="/post-images/nforce-tools/01-home.png" alt="nForce Tools 的功能中心" loading="lazy"></a>
  <div class="project-body">
    <h2 class="project-head"><a href="{{< relref "posts/nforce-tools.md" >}}">nForce Tools</a><span class="project-version">v4.4.0</span></h2>
    <p>给 Salesforce 用户的一套浏览器内数据工作台：连接组织、批量查单、拉报表、跑 Bulk API，全在本地完成。</p>
    <div class="project-actions">
      <a href="{{< relref "posts/nforce-tools.md" >}}">读介绍</a>
      <a href="https://github.com/iamnicwu/nForce-tools" target="_blank" rel="noopener">源码</a>
    </div>
  </div>
</article>

<article class="project-card">
  <a class="project-cover" href="{{< relref "posts/nforce-todo.md" >}}"><img src="/post-images/nforce-todo/01-popup.png" alt="nForce Todo 弹窗" loading="lazy"></a>
  <div class="project-body">
    <h2 class="project-head"><a href="{{< relref "posts/nforce-todo.md" >}}">nForce Todo</a><span class="project-version">v1.1.0</span></h2>
    <p>一行语法记下待办，看板与四象限推进，循环任务到点提醒，并把每天的任务快照自动备份进 ima 知识库。</p>
    <div class="project-actions">
      <a href="{{< relref "posts/nforce-todo.md" >}}">读介绍</a>
      <a href="https://github.com/iamnicwu/nForce-Todo" target="_blank" rel="noopener">源码</a>
    </div>
  </div>
</article>

<article class="project-card">
  <a class="project-cover" href="{{< relref "posts/nforce-screencapture.md" >}}"><img src="/post-images/nforce-screencapture/03-editor.png" alt="nForce Screen Capture 的标注编辑器" loading="lazy"></a>
  <div class="project-body">
    <h2 class="project-head"><a href="{{< relref "posts/nforce-screencapture.md" >}}">nForce Screen Capture</a><span class="project-version">v1.0.0</span></h2>
    <p>截图与录屏二合一：可视区、整页长截图、手动滚动拼接、框选区域，以及带旁白的 MP4 演示录制。</p>
    <div class="project-actions">
      <a href="{{< relref "posts/nforce-screencapture.md" >}}">读介绍</a>
      <a href="https://github.com/iamnicwu/nForce-screenCapture" target="_blank" rel="noopener">源码</a>
    </div>
  </div>
</article>

<article class="project-card">
  <a class="project-cover" href="{{< relref "posts/nforce-autotest.md" >}}"><img src="/post-images/nforce-autotest/00-cover.jpg" alt="nForce AutoTest 品牌横幅" loading="lazy"></a>
  <div class="project-body">
    <h2 class="project-head"><a href="{{< relref "posts/nforce-autotest.md" >}}">nForce AutoTest</a><span class="project-version">v1.0.0</span></h2>
    <p>轻量 Web 自动化测试扩展：手写用例或录制成用例，跑完看结果汇总，还能导出成可直接跑的 Playwright 脚本。</p>
    <div class="project-actions">
      <a href="{{< relref "posts/nforce-autotest.md" >}}">读介绍</a>
      <a href="https://github.com/iamnicwu/nForce-autoTest" target="_blank" rel="noopener">源码</a>
    </div>
  </div>
</article>

</div>

## 四款扩展的共同点

它们共用同一套品牌渐变（`#06B6D4 → #3B82F6 → #7C3AED`），也都是 Manifest V3、零依赖或极少依赖的路线。共同的设计原则只有两条：

- **能在浏览器里做完的事，不要多开一个软件。** 四款扩展都长在工具栏和侧边栏上，需要的时候就在那儿。
- **不要让用户面对一次「什么都没发生」。** 失败要说清楚是哪一环断了 —— 截图失败给诊断日志，录制没声音就明说是默音并给重录入口，会话失效就说明是缺登录态还是缺权限。

全部文章按标签浏览：见 <a href="{{< relref "tags/_index.md" >}}">标签页</a>。
