<template>
  <div class="dictation-page">
    <DictationPanel />
  </div>
</template>

<script setup>
import DictationPanel from '@/components/dictation/DictationPanel.vue'
</script>

<style scoped>
.dictation-page {
  min-height: calc(100vh - 40px);
  padding: 18px;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0) 52%),
    repeating-linear-gradient(45deg, rgba(80, 50, 20, 0.028), rgba(80, 50, 20, 0.028) 7px, rgba(255, 255, 255, 0.035) 7px, rgba(255, 255, 255, 0.035) 14px),
    #f5e8d0;
  border-radius: 22px;
}

@media (max-width: 480px) {
  .dictation-page {
    padding: 12px;
    border-radius: 18px;
  }
}
</style>
