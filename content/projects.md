---
title: "项目"
url: "/projects/"
summary: "写过的 Chrome 扩展与内部工具"
description: "四款 nForce 系列 Chrome 扩展，以及它们各自的介绍文章，全部开源在 GitHub。"
---

这些都是围绕「在浏览器里把活干完」这条线做出来的东西。每一款都配了一篇写了取舍和踩坑过程的介绍，代码在 GitHub 上。

<div class="project-grid">

<article class="project-card">
  <a class="project-cover" href="{{< relref "posts/nforce-tools.md" >}}"><img src="/post-images/nforce-tools-v415/01-home.png" alt="nForce Tools 的新首页" loading="lazy"></a>
  <div class="project-body">
    <h2 class="project-head"><a href="{{< relref "posts/nforce-tools.md" >}}">nForce Tools</a><span class="project-version">v4.15.0</span></h2>
    <p>Salesforce 的日常操作收在一个侧边栏里：连组织、批量查单、看报表、跑 Bulk API、看 Org 用量，数据不经过任何服务器。</p>
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
    <p>快捷键、右键、弹窗都能记，一行语法写完日期和优先级，看板推进，循环任务到点提醒，每天的快照自动备份到 ima。</p>
    <div class="project-actions">
      <a href="{{< relref "posts/nforce-todo.md" >}}">读介绍</a>
      <a href="https://github.com/iamnicwu/nForce-Todo" target="_blank" rel="noopener">源码</a>
    </div>
  </div>
</article>

<article class="project-card">
  <a class="project-cover" href="{{< relref "posts/nforce-screencapture.md" >}}"><img src="/post-images/nforce-screencapture/03-editor.png" alt="nForce Screen Capture 的标注编辑器" loading="lazy"></a>
  <div class="project-body">
    <h2 class="project-head"><a href="{{< relref "posts/nforce-screencapture.md" >}}">nForce Screen Capture</a><span class="project-version">v1.5.0</span></h2>
    <p>截图和录屏合在一个扩展里：可视区、整页长截图、手动滚动拼接、框选区域，加上带旁白的 MP4 录制和标注编辑器。</p>
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
    <p>轻量 Web 自动化测试扩展：用例可以手写也可以录，跑完看每步结果和失败截图，还能导出成 Playwright 脚本放进 CI。</p>
    <div class="project-actions">
      <a href="{{< relref "posts/nforce-autotest.md" >}}">读介绍</a>
      <a href="https://github.com/iamnicwu/nForce-autoTest" target="_blank" rel="noopener">源码</a>
    </div>
  </div>
</article>

</div>

## 四款扩展的共同点

它们共用同一套品牌渐变（`#06B6D4 → #3B82F6 → #7C3AED`），也都是 Manifest V3、零依赖或极少依赖的路线。设计上有两条一直没变：

- 能在浏览器里做完的事，不多开一个软件。四款扩展都长在工具栏和侧边栏上。
- 失败要说清楚是哪一环断了。截图失败给诊断日志，录制没声音就明说是默音并给重录入口，会话失效就说明是缺登录态还是缺权限。

全部文章按标签浏览：见 <a href="{{< relref "tags/_index.md" >}}">标签页</a>。
