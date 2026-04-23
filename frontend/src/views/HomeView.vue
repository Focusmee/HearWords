<template>
  <div class="page-grid">
    <SectionCard
      title="项目概览"
      eyebrow="Home"
      description="HearWords 前端已切换为 Vue 3 + Vite 的结构化壳层，当前先完成页面组织和路由铺设。"
    >
      <div class="status-grid">
        <article class="status-card">
          <span class="status-label">当前阶段</span>
          <strong>壳层搭建</strong>
          <p>页面、路由、目录边界已经划分，暂不接真实 API。</p>
        </article>
        <article class="status-card">
          <span class="status-label">技术选型</span>
          <strong>Vue 3 + Vite + Pinia + Router</strong>
          <p>保持轻量，不引入 UI 组件库，方便后续渐进式迁移。</p>
        </article>
        <article class="status-card">
          <span class="status-label">后续重点</span>
          <strong>模块拆分与数据接入</strong>
          <p>下一步可按 Import、Library、Dictation 分模块继续推进。</p>
        </article>
      </div>
    </SectionCard>

    <SectionCard
      title="页面入口"
      description="四个基础页面已经接入路由，后续可以直接在对应目录继续扩展。"
    >
      <div class="quick-links">
        <RouterLink to="/import" class="quick-link">前往导入模块</RouterLink>
        <RouterLink to="/library" class="quick-link">前往词库模块</RouterLink>
        <RouterLink to="/dictation" class="quick-link">前往听写模块</RouterLink>
      </div>
    </SectionCard>
  </div>
</template>

<script setup>
import SectionCard from '@/components/common/SectionCard.vue'
</script>
