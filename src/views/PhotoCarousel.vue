<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

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

// swipe tactile
let startX = 0
function onTouchStart(e) {
  startX = e.changedTouches[0].clientX
}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - startX
  if (Math.abs(dx) > 50) (dx < 0 ? next() : prev())
}

// clavier : Échap, flèches gauche et droite
function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
      class="overlay"
      @click.self="emit('close')"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
  >
    <button class="close" aria-label="Fermer" @click="emit('close')">✕</button>
    <button class="nav prev" aria-label="Précédente" @click="prev">‹</button>

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

    <button class="nav next" aria-label="Suivante" @click="next">›</button>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.5rem, 2vw, 0.9rem);
}

.slide {
  display: block;
  max-width: min(94vw, 70rem);
  /* on garde de la place pour le lien Instagram et le bouton fermer */
  max-height: calc(100vh - 9rem);
  max-height: calc(100dvh - 9rem);
  object-fit: contain;
  border-radius: 8px;
}

.insta {
  color: #fff;
  font-size: clamp(0.9rem, 3.5vw, 1.1rem);
  text-decoration: underline;
}
.insta:hover { opacity: 0.8; }

button {
  color: #fff;
  background: none;
  border: 0;
  cursor: pointer;
}

.close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.5rem;
}

.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  display: grid;
  place-items: center;
  width: clamp(2.5rem, 8vw, 3.5rem);
  height: clamp(2.5rem, 8vw, 3.5rem);
  font-size: clamp(1.5rem, 5vw, 2.2rem);
  line-height: 1;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
}
.prev { left: clamp(0.25rem, 2vw, 1.5rem); }
.next { right: clamp(0.25rem, 2vw, 1.5rem); }
</style>