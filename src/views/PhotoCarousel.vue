<script setup>
import { ref } from 'vue'
const props = defineProps({ images: Array })
const emit = defineEmits(['close'])
const index = ref(0)

const next = () => (index.value = (index.value + 1) % props.images.length)
const prev = () => (index.value = (index.value - 1 + props.images.length) % props.images.length)
</script>

<template>
  <div class="overlay" @click.self="emit('close')" @keydown.esc="emit('close')" tabindex="0">
    <button class="close" @click="emit('close')">✕</button>
    <button @click="prev">‹</button>
    <img :src="images[index]" class="slide" />
    <button @click="next">›</button>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; gap: 16px; z-index: 50; }
.slide { max-width: 80vw; max-height: 85vh; border-radius: 8px; }
.close { position: absolute; top: 16px; right: 16px; }
button { font-size: 2rem; background: none; border: 0; color: #fff; cursor: pointer; }
</style>