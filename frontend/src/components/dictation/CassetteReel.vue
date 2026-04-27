<template>
  <div class="reel" :class="{ 'reel--playing': isPlaying }" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg class="reel__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient :id="faceId" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#fff7e4" />
          <stop offset="55%" stop-color="#f3d9b5" />
          <stop offset="100%" stop-color="#e9c79c" />
        </radialGradient>
        <radialGradient :id="hubId" cx="45%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#fff7e4" />
          <stop offset="100%" stop-color="#d1a778" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="46" :fill="`url(#${faceId})`" stroke="#c98242" stroke-width="3" />
      <circle cx="50" cy="50" r="18" :fill="`url(#${hubId})`" stroke="#b57941" stroke-width="2" />

      <g fill="#fdf1d6" stroke="#b57941" stroke-width="2">
        <circle cx="50" cy="26" r="5.2" />
        <circle cx="71" cy="38" r="5.2" />
        <circle cx="71" cy="62" r="5.2" />
        <circle cx="50" cy="74" r="5.2" />
        <circle cx="29" cy="62" r="5.2" />
        <circle cx="29" cy="38" r="5.2" />
      </g>

      <g stroke="#b57941" stroke-width="2.5" stroke-linecap="round" opacity="0.7">
        <path d="M50 32 L50 40" />
        <path d="M66 41 L60 46" />
        <path d="M66 59 L60 54" />
        <path d="M50 68 L50 60" />
        <path d="M34 59 L40 54" />
        <path d="M34 41 L40 46" />
      </g>
    </svg>
  </div>
</template>

<script setup>
defineProps({
  isPlaying: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 84
  }
})

const faceId = `hw_reel_face_${Math.random().toString(36).slice(2, 9)}`
const hubId = `hw_reel_hub_${Math.random().toString(36).slice(2, 9)}`
</script>

<style scoped>
.reel {
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 999px;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.6),
    inset 0 -6px 10px rgba(80, 50, 20, 0.15);
  background: radial-gradient(circle at 40% 35%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 60%);
}

.reel__svg {
  width: 100%;
  height: 100%;
  transform-origin: 50% 50%;
  animation: hw-reel-spin 1.2s linear infinite;
  animation-play-state: paused;
  filter: drop-shadow(0 8px 12px rgba(80, 50, 20, 0.12));
}

.reel--playing .reel__svg {
  animation-play-state: running;
}

@keyframes hw-reel-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
