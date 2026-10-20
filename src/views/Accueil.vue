<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase' // ton client existant
import PhotoCarousel from '@/views/PhotoCarousel.vue'


const photos = ref([])
const selected = ref(null)
const related = ref([])

onMounted(async () => {
  const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('position')
  if (!error) photos.value = data
})

async function saveOrder() {
  const ids = photos.value.map(p => p.id)
  const { error } = await supabase.rpc('reorder_photos', { ids })
  if (error) console.error(error)
}

async function openCarousel(photo) {
  selected.value = photo
  const { data } = await supabase
      .from('photo_images')
      .select('url')
      .eq('photo_id', photo.id)
      .order('position')
  // la photo principale en premier, puis les photos liées
  related.value = [photo.url, ...(data ?? []).map(i => i.url)]
}


// lignes à effectif fixe, puis lignes de TAIL images maximum pour le reste
const ROWS = [1, 4, 7]
const TAIL = 7
const COLS = Math.max(...ROWS, TAIL)
const fixedCount = ROWS.reduce((a, b) => a + b, 0)

// n = nombre d'images sur la ligne ; chaque image occupe 2 demi-colonnes
function cell(row, pos, n) {
  const shift = COLS - n
  return { gridRow: row, gridColumn: `${shift + pos * 2 + 1} / span 2` }
}

function placement(index) {
  let start = 0
  for (let r = 0; r < ROWS.length; r++) {
    if (index < start + ROWS[r]) return cell(r * 2 + 2, index - start, ROWS[r])
    start += ROWS[r]
  }
  const offset = index - fixedCount
  const tailRow = Math.floor(offset / TAIL)
  const rowStart = fixedCount + tailRow * TAIL
  const n = Math.min(TAIL, photos.value.length - rowStart)
  return cell(ROWS.length * 2 + 1 + tailRow, offset % TAIL, n)
}

const dragIndex = ref(null)
const overIndex = ref(null)

function onDragStart(index, e) {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', '') // requis par Firefox
}

function resetDrag() {
  dragIndex.value = null
  overIndex.value = null
}

function onDrop(index) {
  const from = dragIndex.value
  resetDrag()
  if (from === null || from === index) return

  const list = [...photos.value]
  ;[list[from], list[index]] = [list[index], list[from]]
  photos.value = list
  saveOrder()
}

</script>

<template>

  <div class="grid" :style="{ '--cols': COLS }">
    <h2 class="banner" style="grid-row: 1">Miss France</h2>
    <h2 class="banner" style="grid-row: 3">5 finalistes</h2>
    <h2 class="banner" style="grid-row: 5">12 concurrentes</h2>
    <h2 class="banner" style="grid-row: 7">Les autres</h2>

    <div class="items">
      <figure
          v-for="(element, index) in photos"
          :key="element.id"
          class="card"
          :class="{
      dragging: dragIndex === index,
      over: overIndex === index && dragIndex !== index,
    }"
          :style="placement(index)"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent="overIndex = index"
          @dragleave="overIndex = null"
          @drop.prevent="onDrop(index)"
          @dragend="resetDrag"
          @click="openCarousel(element)"
      >
        <img :src="element.url" :alt="element.title" class="thumb" />
        <figcaption class="caption" :title="element.title">
          {{ element.title }}
        </figcaption>
      </figure>
    </div>
  </div>

  <PhotoCarousel
      v-if="selected"
      :images="related"
      @close="selected = null"
  />
</template>

<style scoped>
.grid {
  --size: 110px;
  --gap: 12px;
  display: grid;
  grid-template-columns: repeat(calc(var(--cols) * 2), calc((var(--size) - var(--gap)) / 2));
  grid-auto-rows: auto; /* bandeaux et lignes de photos s'adaptent à leur contenu */
  gap: var(--gap);
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  overflow-x: auto;
}

.card {
  margin: 0;
  width: var(--size);
  cursor: grab;
  user-select: none;
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
.items {
  display: contents;
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
</style>