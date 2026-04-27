<template>
  <section class="player" aria-label="复古磁带播放器">
    <header class="player__top">
      <div class="player__brand">
        <span class="player__brand-mark" aria-hidden="true" />
        <div class="player__brand-text">
          <p class="player__brand-title">{{ title }}</p>
          <p class="player__brand-sub">{{ subtitle }}</p>
        </div>
      </div>
      <div class="player__hud">
        <div class="hud-chip">
          <p class="hud-chip__label">词书</p>
          <p class="hud-chip__value">{{ bookText }}</p>
        </div>
        <div class="hud-chip">
          <p class="hud-chip__label">进度</p>
          <p class="hud-chip__value">{{ progressText }}</p>
        </div>
        <div class="hud-chip">
          <p class="hud-chip__label">状态</p>
          <p class="hud-chip__value" :class="{ 'hud-chip__value--warn': Boolean(errorText) }">
            {{ errorText || statusText }}
          </p>
        </div>
      </div>
    </header>

    <div class="player__body">
      <div class="cassette">
        <div class="cassette__window">
          <div class="cassette__window-bezel" aria-hidden="true" />
          <div class="cassette__reels">
            <CassetteReel :is-playing="isPlaying" :size="reelSize" />
            <CassetteReel :is-playing="isPlaying" :size="reelSize" />
          </div>
          <div class="cassette__tape">
            <div class="cassette__tape-track" />
            <div class="cassette__tape-progress" :style="{ width: `${progressPct}%` }" />
            <div class="cassette__tape-ticks" aria-hidden="true" />
          </div>
        </div>

        <div class="cassette__display">
          <p class="cassette__display-label">{{ displayLabel }}</p>
          <p class="cassette__display-word">{{ displayText }}</p>
          <p v-if="detailText" class="cassette__display-detail">{{ detailText }}</p>
        </div>

        <div class="cassette__controls">
          <slot name="controls" />
        </div>
      </div>

      <div class="player__bottom">
        <slot name="input" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import CassetteReel from '@/components/dictation/CassetteReel.vue'

const props = defineProps({
  title: { type: String, default: 'HearWords 随身听' },
  subtitle: { type: String, default: '复古听写随身听' },
  bookText: { type: String, default: '—' },
  progressText: { type: String, default: '—' },
  statusText: { type: String, default: '' },
  errorText: { type: String, default: '' },
  displayLabel: { type: String, default: '当前单词' },
  displayText: { type: String, default: '准备就绪' },
  detailText: { type: String, default: '' },
  isPlaying: { type: Boolean, default: false },
  progress: { type: Number, default: 0 }
})

const progressPct = computed(() => {
  const value = Number.isFinite(props.progress) ? props.progress : 0
  const clamped = Math.min(1, Math.max(0, value))
  return Math.round(clamped * 100)
})

const reelSize = computed(() => 88)
</script>

<style scoped>
.player {
  color: #3f3428;
}

.player__top {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.player__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.player__brand-mark {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1px solid rgba(201, 130, 66, 0.8);
  background: linear-gradient(180deg, rgba(111, 143, 114, 0.95), rgba(72, 106, 77, 0.95));
  box-shadow: 0 10px 18px rgba(80, 50, 20, 0.18);
}

.player__brand-title {
  margin: 0;
  font-weight: 950;
  letter-spacing: 0.3px;
}

.player__brand-sub {
  margin: 2px 0 0;
  color: #6d5a45;
  font-size: 0.9rem;
}

.player__hud {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.hud-chip {
  border-radius: 14px;
  border: 1px solid rgba(201, 130, 66, 0.45);
  padding: 10px 10px 8px;
  background: rgba(245, 232, 208, 0.65);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  min-width: 0;
}

.hud-chip__label {
  margin: 0;
  color: #6d5a45;
  font-size: 0.78rem;
  letter-spacing: 0.2px;
}

.hud-chip__value {
  margin: 6px 0 0;
  font-weight: 900;
  font-size: 0.96rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-chip__value--warn {
  color: #8b3b2f;
}

.player__body {
  display: grid;
  gap: 14px;
}

.cassette {
  position: relative;
  border-radius: 26px;
  border: 2px solid rgba(201, 130, 66, 0.95);
  background:
    radial-gradient(circle at 16% 12%, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0) 60%),
    repeating-linear-gradient(45deg, rgba(80, 50, 20, 0.035), rgba(80, 50, 20, 0.035) 6px, rgba(255, 255, 255, 0.04) 6px, rgba(255, 255, 255, 0.04) 12px),
    #fdf1d6;
  box-shadow:
    0 26px 46px rgba(80, 50, 20, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
  padding: 18px;
}

.cassette::before {
  content: '';
  position: absolute;
  inset: 10px;
  border-radius: 22px;
  border: 1px solid rgba(201, 130, 66, 0.35);
  pointer-events: none;
}

.cassette__window {
  border-radius: 20px;
  border: 1px solid rgba(201, 130, 66, 0.65);
  background: linear-gradient(180deg, rgba(245, 232, 208, 0.75), rgba(245, 232, 208, 0.5));
  padding: 14px 14px 12px;
  position: relative;
  overflow: hidden;
}

.cassette__window-bezel {
  position: absolute;
  inset: 8px;
  border-radius: 16px;
  border: 1px solid rgba(201, 130, 66, 0.35);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.cassette__reels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: center;
  justify-items: center;
  padding: 8px 6px 4px;
}

.cassette__tape {
  position: relative;
  margin-top: 10px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid rgba(201, 130, 66, 0.55);
  background: rgba(253, 241, 214, 0.8);
  overflow: hidden;
}

.cassette__tape-track {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(111, 143, 114, 0.16), rgba(217, 164, 65, 0.1), rgba(111, 143, 114, 0.16));
}

.cassette__tape-progress {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, rgba(111, 143, 114, 0.9), rgba(217, 164, 65, 0.85));
}

.cassette__tape-ticks {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(90deg, rgba(201, 130, 66, 0.35) 0 1px, transparent 1px 12px);
  mix-blend-mode: multiply;
  opacity: 0.35;
}

.cassette__display {
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid rgba(201, 130, 66, 0.55);
  background: linear-gradient(180deg, rgba(245, 232, 208, 0.92), rgba(245, 232, 208, 0.72));
  padding: 14px 14px 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.cassette__display-label {
  margin: 0;
  color: #6d5a45;
  font-size: 0.82rem;
  letter-spacing: 0.2px;
}

.cassette__display-word {
  margin: 8px 0 0;
  font-weight: 950;
  letter-spacing: 0.3px;
  font-size: clamp(1.2rem, 3.4vw, 1.85rem);
  line-height: 1.15;
  word-break: break-word;
}

.cassette__display-detail {
  margin: 8px 0 0;
  color: #6d5a45;
  font-size: 0.92rem;
  line-height: 1.35;
}

.cassette__controls {
  margin-top: 14px;
}

.player__bottom {
  border-radius: 18px;
  border: 1px dashed rgba(201, 130, 66, 0.55);
  background: rgba(253, 241, 214, 0.5);
  padding: 14px;
}

@media (max-width: 720px) {
  .player__hud {
    grid-template-columns: 1fr;
  }
}
</style>
