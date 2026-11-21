<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  // les mois commencent à 0 en JS : 11 = décembre
  target: { type: Date, default: () => new Date(2026, 11, 12, 20, 0, 0) },
})

const now = ref(Date.now())
let timer = null

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => clearInterval(timer))

const remaining = computed(() => Math.max(0, props.target.getTime() - now.value))
const finished = computed(() => remaining.value === 0)

const parts = computed(() => {
  const total = Math.floor(remaining.value / 1000)
  return [
    { label: 'jours', value: Math.floor(total / 86400) },
    { label: 'heures', value: Math.floor((total % 86400) / 3600) },
    { label: 'minutes', value: Math.floor((total % 3600) / 60) },
    { label: 'secondes', value: total % 60 },
  ]
})

const pad = (n) => String(n).padStart(2, '0')
</script>

<template>
  <div class="countdown">
    <p v-if="finished" class="finished">C'est parti !</p>
    <template v-else>
      <div v-for="p in parts" :key="p.label" class="unit">
        <span class="value">{{ pad(p.value) }}</span>
        <span class="label">{{ p.label }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.countdown {
  display: flex;
  justify-content: center;
  gap: clamp(6px, 2vw, 16px);
  margin: 0 auto 16px;
  padding: 12px clamp(8px, 3vw, 16px);
  color: #fff;
  background: #222;
  border-radius: 8px;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
}
.unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0; /* permet aux blocs de rétrécir */
}
.value {
  font-size: clamp(1.2rem, 6vw, 1.8rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.label {
  font-size: clamp(0.55rem, 2.4vw, 0.7rem);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}
.finished {
  font-size: 1.2rem;
  margin: 0 auto;
}
</style>