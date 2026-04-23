<template>
  <section class="section-card">
    <header class="section-card__header">
      <div>
        <p v-if="eyebrow" class="section-card__eyebrow">{{ eyebrow }}</p>
        <h2 class="section-card__title">{{ title }}</h2>
      </div>
      <slot name="header-extra" />
    </header>

    <p v-if="description" class="section-card__description">
      {{ description }}
    </p>

    <div class="section-card__content">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  eyebrow: {
    type: String,
    default: ''
  }
})
</script>
