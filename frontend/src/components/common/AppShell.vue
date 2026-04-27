<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">HW</span>
        <div>
          <p class="brand-name">HearWords</p>
          <p class="brand-subtitle">听写记忆训练系统</p>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
        >
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-desc">{{ item.description }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main class="content">
      <header class="content-header">
        <p class="eyebrow">HearWords</p>
        <h1 class="title">听写记忆训练</h1>
        <p class="subtitle">
          从今日任务开始，完成听写、整理错词，并把薄弱单词带回后续复习计划。
        </p>
      </header>

      <RouterView />
    </main>
  </div>
</template>

<script setup>
const navItems = [
  {
    to: '/',
    label: '首页',
    description: '项目总览与模块入口'
  },
  {
    to: '/import',
    label: '导入',
    description: '文件导入与解析预留区'
  },
  {
    to: '/library',
    label: '词库',
    description: '单词集与资源管理预留区'
  },
  {
    to: '/books',
    label: '词书',
    description: '词书管理与成员查看'
  },
  {
    to: '/wrong-words',
    label: '错词本',
    description: '薄弱单词与复习卡片'
  },
  {
    to: '/report',
    label: '学习报告',
    description: '今日概览与薄弱建议'
  },
  {
    to: '/dictation',
    label: '听写',
    description: '练习流程与结果展示预留区'
  }
]
</script>
