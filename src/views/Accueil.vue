<script setup>
console.log('Home.vue : script chargé')

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import PhotoCarousel from '@/views/PhotoCarousel.vue'

const photos = ref([])
const selected = ref(null)
const related = ref([])
const user = ref(null)
const router = useRouter()

// --- responsive
const isMobile = ref(false)
let mq
const onMq = e => (isMobile.value = e.matches)

onMounted(async () => {
  console.log('Home.vue : monté')

  mq = window.matchMedia('(max-width: 640px)')
  isMobile.value = mq.matches
  mq.addEventListener('change', onMq)

  const { data: auth, error: authError } = await supabase.auth.getUser()
  console.log('session :', auth?.user?.id, authError)
  user.value = auth?.user ?? null

  const [{ data: all }, { data: orders }] = await Promise.all([
    supabase.from('photos').select('*').order('position'),
    supabase.from('user_photo_order').select('photo_id, position'),
  ])

  const pos = new Map((orders ?? []).map(o => [o.photo_id, o.position]))
  photos.value = [...(all ?? [])].sort(
      (a, b) =>
          (pos.get(a.id) ?? 1e6 + a.position) - (pos.get(b.id) ?? 1e6 + b.position)
  )
})

onBeforeUnmount(() => mq?.removeEventListener('change', onMq))

async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error(error)
    return
  }
  user.value = null
  router.push('/login')
}

async function saveOrder() {
  console.log('saveOrder, user =', user.value?.id)
  if (!user.value) {
    console.warn('Pas de session : ordre non sauvegardé')
    return
  }
  const ids = photos.value.map(p => p.id)
  const { error } = await supabase.rpc('save_photo_order', { ids })
  console.log('rpc save_photo_order :', error ?? 'ok')
}

async function openCarousel(photo) {
  selected.value = photo
  const { data } = await supabase
      .from('photo_images')
      .select('url')
      .eq('photo_id', photo.id)
      .order('position')
  related.value = [photo.url, ...(data ?? []).map(i => i.url)]
}

// --- disposition : groupes avec bandeau, découpés en lignes de perRow max
const GROUPS = [
  { title: 'Miss France', count: 1 },
  { title: '5 finalistes', count: 4 },
  { title: '12 concurrentes', count: 7 },
  { title: 'Les autres', count: Infinity },
]

const perRow = computed(() => (isMobile.value ? 4 : 7))

// n = nombre d'images sur la ligne ; chaque image occupe 2 demi-colonnes
function cell(row, pos, n) {
  const shift = perRow.value - n
  return { gridRow: row, gridColumn: `${shift + pos * 2 + 1} / span 2` }
}

const layout = computed(() => {
  const total = photos.value.length
  const placements = []
  const banners = []
  let index = 0
  let row = 1

  for (const g of GROUPS) {
    const count = Math.min(g.count, total - index)
    if (count <= 0) break
    banners.push({ title: g.title, row })
    row++
    const rows = Math.ceil(count / perRow.value)
    for (let r = 0; r < rows; r++) {
      const inRow = Math.min(perRow.value, count - r * perRow.value)
      for (let p = 0; p < inRow; p++) {
        placements[index++] = cell(row, p, inRow)
      }
      row++
    }
  }
  return { placements, banners }
})

// --- échange de deux photos
function swap(a, b) {
  const list = [...photos.value]
  ;[list[a], list[b]] = [list[b], list[a]]
  photos.value = list
  saveOrder()
}

// glisser-déposer (ordinateur)
const dragIndex = ref(null)
const overIndex = ref(null)

function onDragStart(index, e) {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', '')
}

function resetDrag() {
  dragIndex.value = null
  overIndex.value = null
}

function onDrop(index) {
  const from = dragIndex.value
  resetDrag()
  if (from === null || from === index) return
  swap(from, index)
}

// mode « Réorganiser » (tactile) : toucher une photo, puis une autre
const reorderMode = ref(false)
const picked = ref(null)

function toggleReorder() {
  reorderMode.value = !reorderMode.value
  picked.value = null
}

function onCardClick(element, index) {
  console.log('clic carte', index, 'mode réorganiser =', reorderMode.value)
  if (!reorderMode.value) return openCarousel(element)
  if (picked.value === null) {
    picked.value = index
    return
  }
  if (picked.value !== index) swap(picked.value, index)
  picked.value = null
}
</script>

<template>
  <div class="grid" :style="{ '--cols': perRow }">
    <h2
        v-for="b in layout.banners"
        :key="b.title"
        class="banner"
        :style="{ gridRow: b.row }"
    >
      {{ b.title }}
    </h2>

    <div class="items">
      <figure
          v-for="(element, index) in photos"
          :key="element.id"
          class="card"
          :class="{
          dragging: dragIndex === index,
          over: overIndex === index && dragIndex !== index,
          picked: picked === index,
        }"
          :style="layout.placements[index]"
          :draggable="!!user"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent="overIndex = index"
          @dragleave="overIndex = null"
          @drop.prevent="onDrop(index)"
          @dragend="resetDrag"
          @click="onCardClick(element, index)"
      >
        <img
            :src="element.url"
            :alt="element.title"
            class="thumb"
            loading="lazy"
            decoding="async"
        />
        <figcaption class="caption" :title="element.title">
          {{ element.title }}
        </figcaption>
      </figure>
    </div>
  </div>

  <PhotoCarousel
      v-if="selected"
      :images="related"
      :insta="selected.compte_insta"
      @close="selected = null"
  />

  <button v-if="user" class="fab logout" @click="logout">Se déconnecter</button>
  <button
      v-if="user"
      class="fab reorder"
      :class="{ active: reorderMode }"
      @click="toggleReorder"
  >
    {{ reorderMode ? 'Terminer' : 'Réorganiser' }}
  </button>
</template>

<style scoped>
.grid {
  --size: 110px;
  --gap: 12px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(calc(var(--cols) * 2), calc((var(--size) - var(--gap)) / 2));
  grid-auto-rows: auto;
  gap: var(--gap);
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 12px 12px 80px; /* le bas laisse la place aux boutons fixes */
  overflow-x: auto;
}

.items { display: contents; }

.card {
  margin: 0;
  width: var(--size);
  cursor: grab;
  user-select: none;
  -webkit-touch-callout: none;
}

.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.caption {
  margin-top: 6px;
  font-size: 0.8rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner {
  grid-column: 1 / -1;
  margin: 8px 0 0;
  padding: 10px 16px;
  text-align: center;
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  background: #222;
  border-radius: 8px;
}

.dragging { opacity: 0.4; }
.over .thumb { outline: 3px solid #4a90e2; outline-offset: 2px; }
.picked .thumb { outline: 3px solid #f5a623; outline-offset: 2px; }

.fab {
  position: fixed;
  bottom: 16px;
  padding: 10px 14px;
  font-size: 0.9rem;
  color: #fff;
  background: #222;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10;
}
.fab:hover { background: #444; }
.logout { left: 16px; }
.reorder { right: 16px; }
.reorder.active { background: #4a90e2; }

@media (max-width: 640px) {
  .grid {
    --gap: 8px;
    /* 4 colonnes qui tiennent exactement dans l'écran */
    --size: calc((100vw - 26px - 3 * var(--gap)) / 4);
  }
  .caption { font-size: 0.7rem; }
  .banner { font-size: 0.95rem; padding: 8px 12px; }
}
</style>