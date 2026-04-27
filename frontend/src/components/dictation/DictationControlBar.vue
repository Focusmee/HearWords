<template>
  <div class="bar" role="group" aria-label="听写控制">
    <button class="bar__btn bar__btn--primary" type="button" :disabled="disabled" @click="$emit('play')">
      <span class="bar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 7l10 5-10 5V7z" fill="currentColor" />
        </svg>
      </span>
      <span class="bar__label">播放</span>
    </button>

    <button class="bar__btn" type="button" :disabled="disabled || !isPlaying" @click="$emit('pause')">
      <span class="bar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 6h4v12H7zM13 6h4v12h-4z" fill="currentColor" />
        </svg>
      </span>
      <span class="bar__label">暂停</span>
    </button>

    <button class="bar__btn" type="button" :disabled="disabled" @click="$emit('replay')">
      <span class="bar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-9.07 2.8l-1.42 1.42A7 7 0 0 0 19 13c0-3.87-3.13-7-7-7z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span class="bar__label">重播</span>
    </button>

    <button class="bar__btn" type="button" :disabled="disabled || !canSkip" @click="$emit('skip')">
      <span class="bar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6 7l8 5-8 5V7zm10 0h2v10h-2V7z" fill="currentColor" />
        </svg>
      </span>
      <span class="bar__label">跳过</span>
    </button>

    <button class="bar__btn bar__btn--ghost" type="button" :disabled="disabled || !canShowAnswer" @click="$emit('toggle-answer')">
      <span class="bar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M12 5c5.5 0 9.5 4.6 10 7-.5 2.4-4.5 7-10 7S2.5 14.4 2 12c.5-2.4 4.5-7 10-7zm0 2C8 7 4.9 10.3 4.1 12 4.9 13.7 8 17 12 17s7.1-3.3 7.9-5C19.1 10.3 16 7 12 7zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span class="bar__label">答案</span>
    </button>

    <slot name="extra" />
  </div>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  canSkip: {
    type: Boolean,
    default: true
  },
  canShowAnswer: {
    type: Boolean,
    default: true
  }
})

defineEmits(['play', 'pause', 'replay', 'skip', 'toggle-answer'])
</script>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.bar__btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(201, 130, 66, 0.7);
  background: linear-gradient(180deg, rgba(253, 241, 214, 0.95), rgba(246, 226, 184, 0.95));
  color: #3f3428;
  box-shadow:
    0 10px 18px rgba(80, 50, 20, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  cursor: pointer;
  user-select: none;
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
}

.bar__btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    0 12px 22px rgba(80, 50, 20, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.bar__btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow:
    0 8px 14px rgba(80, 50, 20, 0.12),
    inset 0 2px 10px rgba(80, 50, 20, 0.12);
}

.bar__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  filter: grayscale(0.15);
}

.bar__btn--primary {
  border-color: rgba(217, 164, 65, 0.95);
  background: linear-gradient(180deg, rgba(217, 164, 65, 0.95), rgba(201, 130, 66, 0.92));
  color: #2e241a;
}

.bar__btn--ghost {
  border-style: dashed;
  background: linear-gradient(180deg, rgba(253, 241, 214, 0.6), rgba(253, 241, 214, 0.25));
  color: #6d5a45;
}

.bar__icon {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
}

.bar__icon svg {
  width: 18px;
  height: 18px;
}

.bar__label {
  font-weight: 650;
  letter-spacing: 0.2px;
  font-size: 0.92rem;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .bar__btn {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>
