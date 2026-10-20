<script setup>

import { ref, computed } from 'vue'
const props = defineProps({ images: Array, insta: String })
const emit = defineEmits(['close'])
const index = ref(0)

const next = () => (index.value = (index.value + 1) % props.images.length)
const prev = () => (index.value = (index.value - 1 + props.images.length) % props.images.length)


// accepte "@pseudo", "pseudo" ou une URL complète
const instaHandle = computed(() => {
  const v = props.insta?.trim()
  if (!v) return null
  return v
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/[/?#].*$/, '')
})

const instaUrl = computed(() =>
    instaHandle.value
        ? `https://www.instagram.com/${encodeURIComponent(instaHandle.value)}`
        : null
)

let startX = 0
function onTouchStart(e) {
  startX = e.changedTouches[0].clientX
}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - startX
  if (Math.abs(dx) > 50) (dx < 0 ? next() : prev())
}

</script>

<template>
  <div class="overlay" @click.self="emit('close')" @keydown.esc="emit('close')" tabindex="0">
    <button class="close" @click="emit('close')">✕</button>
    <button @click="prev">‹</button>
    <div class="stage">
      <img :src="images[index]" class="slide" />
      <a
          v-if="instaUrl"
          :href="instaUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="insta"
      >
        @{{ instaHandle }}
      </a>
    </div>
    <button @click="next">›</button>
  </div>

  <button class="close" @click="emit('close')">✕</button>
  <button class="nav prev" @click="prev">‹</button>

  <div class="stage" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
    <!-- image + lien Instagram inchangés -->
  </div>

  <button class="nav next" @click="next">›</button>

</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; gap: 16px; z-index: 50; }
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.slide { max-width: 80vw; max-height: 75vh; border-radius: 8px; }
.insta {
  color: #fff;
  font-size: 1rem;
  text-decoration: underline;
}
.insta:hover { opacity: 0.8; }
button { font-size: 2rem; background: none; border: 0; color: #fff; cursor: pointer; }

.close { width: 44px; height: 44px; }

@media (max-width: 640px) {
  .overlay { gap: 0; }
  .slide { max-width: 100vw; max-height: 70vh; border-radius: 0; }
  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    font-size: 1.6rem;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
  }
  .prev { left: 8px; }
  .next { right: 8px; }
}
</style>