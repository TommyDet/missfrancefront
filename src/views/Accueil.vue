<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import PhotoCarousel from '@/views/PhotoCarousel.vue'

const router = useRouter()
const user = ref(null)
const selected = ref(null)
const related = ref([])

// --- emplacements du haut (numérotés de 1 à 12, vides par défaut) + les autres photos
const GROUPS = [
  { title: 'Miss France', count: 1 },
  { title: '5 finalistes', count: 4 },
  { title: '12 concurrentes', count: 7 },
]
const OTHERS_TITLE = 'Les autres'
const TOP = GROUPS.reduce((s, g) => s + g.count, 0) // 12

const slots = ref(Array(TOP).fill(null))
const others = ref([])

// --- responsive
const width = ref(1200)
const onResize = () => (width.value = window.innerWidth)
const perRow = computed(() => (width.value < 640 ? 3 : width.value < 1024 ? 5 : 7))

onMounted(async () => {
  window.addEventListener('resize', onResize)
  onResize()

  const { data: auth } = await supabase.auth.getUser()
  user.value = auth?.user ?? null

  const [{ data: all }, { data: orders }] = await Promise.all([
    supabase.from('photos').select('*'),
    // grâce au RLS, seules les lignes de l'utilisateur connecté sont renvoyées
    supabase.from('user_photo_order').select('photo_id, position'),
  ])

  const pos = new Map((orders ?? []).map(o => [o.photo_id, o.position]))
  const s = Array(TOP).fill(null)
  const rest = []

  for (const p of all ?? []) {
    const n = pos.get(p.id)
    if (n && n <= TOP && !s[n - 1]) s[n - 1] = p
    else rest.push(p)
  }

  // « Les autres » : ordre personnel s'il existe, sinon par titre
  rest.sort(
      (a, b) =>
          (pos.get(a.id) ?? 1e6) - (pos.get(b.id) ?? 1e6) ||
          (a.title ?? '').localeCompare(b.title ?? '')
  )

  slots.value = s
  others.value = rest
})

onBeforeUnmount(() => window.removeEventListener('resize', onResize))

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
  if (!user.value) return
  // un emplacement vide reste vide : le null conserve la numérotation 1 à 12
  const ids = [
    ...slots.value.map(p => p?.id ?? null),
    ...others.value.map(p => p.id),
  ]
  const { error } = await supabase.rpc('save_photo_order', { ids })
  if (error) console.error(error)
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

// --- disposition
// n = nombre de cases sur la ligne ; chaque case occupe 2 demi-colonnes
function cell(row, pos, n) {
  const shift = perRow.value - n
  return { gridRow: row, gridColumn: `${shift + pos * 2 + 1} / span 2` }
}

const layout = computed(() => {
  const cells = []
  const banners = []
  let row = 1
  let slotIndex = 0

  const addGroup = (title, items, isOthers = false) => {
    banners.push({ title, row, isOthers })
    row++
    const rows = Math.ceil(items.length / perRow.value)
    for (let r = 0; r < rows; r++) {
      const chunk = items.slice(r * perRow.value, (r + 1) * perRow.value)
      chunk.forEach((item, p) => {
        cells.push({ ...item, style: cell(row, p, chunk.length) })
      })
      row++
    }
  }

  for (const g of GROUPS) {
    const items = []
    for (let i = 0; i < g.count; i++, slotIndex++) {
      items.push({ kind: 'slot', index: slotIndex, photo: slots.value[slotIndex] })
    }
    addGroup(g.title, items)
  }

  addGroup(
      OTHERS_TITLE,
      others.value.map((photo, index) => ({ kind: 'other', index, photo })),
      true
  )

  return { cells, banners }
})

// --- déplacements : un emplacement ou une photo des autres, identifié par { kind, index }
const keyOf = c => `${c.kind}:${c.index}`
const spot = c => ({ kind: c.kind, index: c.index })
const sameSpot = (a, b) => a.kind === b.kind && a.index === b.index

function moveTo(from, to) {
  if (sameSpot(from, to)) return
  const s = [...slots.value]
  const o = [...others.value]
  const read = ({ kind, index }) => (kind === 'slot' ? s[index] : o[index])
  const write = ({ kind, index }, v) => {
    if (kind === 'slot') s[index] = v
    else o[index] = v
  }

  const photoFrom = read(from)
  if (!photoFrom) return
  const photoTo = read(to)

  // échange ; si la destination est vide, la source devient vide
  write(to, photoFrom)
  write(from, photoTo ?? null)

  slots.value = s
  others.value = o.filter(Boolean) // « Les autres » ne garde pas de trou
  saveOrder()
}

// renvoie une photo d'un emplacement vers « Les autres »
function sendToOthers(from) {
  if (!from || from.kind !== 'slot') return
  const photo = slots.value[from.index]
  if (!photo) return
  const s = [...slots.value]
  s[from.index] = null
  slots.value = s
  others.value = [...others.value, photo]
  saveOrder()
}

// glisser-déposer (ordinateur)
const dragFrom = ref(null)
const overKey = ref(null)

const isDragging = c => !!dragFrom.value && sameSpot(dragFrom.value, c)

function onDragStart(c, e) {
  dragFrom.value = spot(c)
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', '')
}

function resetDrag() {
  dragFrom.value = null
  overKey.value = null
}

function onDrop(c) {
  const from = dragFrom.value
  resetDrag()
  if (from) moveTo(from, spot(c))
}

function onBannerDrop(b) {
  const from = dragFrom.value
  resetDrag()
  if (b.isOthers) sendToOthers(from)
}

// mode « Réorganiser » (tactile) : toucher une photo, puis sa destination
const reorderMode = ref(false)
const picked = ref(null)

const isPicked = c => !!picked.value && sameSpot(picked.value, c)

function toggleReorder() {
  reorderMode.value = !reorderMode.value
  picked.value = null
}

function onCardClick(c) {
  if (!reorderMode.value) {
    if (c.photo) openCarousel(c.photo)
    return
  }
  if (!picked.value) {
    if (c.photo) picked.value = spot(c)
    return
  }
  moveTo(picked.value, spot(c))
  picked.value = null
}

function onBannerClick(b) {
  if (!b.isOthers || !reorderMode.value || !picked.value) return
  sendToOthers(picked.value)
  picked.value = null
}
</script>

<template>
  <div class="grid" :style="{ '--cols': perRow }">
    <h2
        v-for="b in layout.banners"
        :key="b.title"
        class="banner"
        :class="{ drop: b.isOthers && (dragFrom || picked) }"
        :style="{ gridRow: b.row }"
        @dragover.prevent
        @drop.prevent="onBannerDrop(b)"
        @click="onBannerClick(b)"
    >
      {{ b.title }}
    </h2>

    <div class="items">
      <template
          v-for="c in layout.cells"
          :key="c.photo ? c.photo.id : `empty-${c.index}`"
      >
        <figure
            v-if="c.photo"
            class="card"
            :class="{
            dragging: isDragging(c),
            over: overKey === keyOf(c) && !isDragging(c),
            picked: isPicked(c),
          }"
            :style="c.style"
            :draggable="!!user"
            @dragstart="onDragStart(c, $event)"
            @dragover.prevent="overKey = keyOf(c)"
            @dragleave="overKey = null"
            @drop.prevent="onDrop(c)"
            @dragend="resetDrag"
            @click="onCardClick(c)"
        >
          <img
              :src="c.photo.url"
              :alt="c.photo.title"
              class="thumb"
              loading="lazy"
              decoding="async"
          />
          <figcaption class="caption" :title="c.photo.title">
            {{ c.photo.title }}
          </figcaption>
        </figure>

        <div
            v-else
            class="slot"
            :class="{ over: overKey === keyOf(c) }"
            :style="c.style"
            @dragover.prevent="overKey = keyOf(c)"
            @dragleave="overKey = null"
            @drop.prevent="onDrop(c)"
            @click="onCardClick(c)"
        >
          {{ c.index + 1 }}
        </div>
      </template>
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
  --max: 100rem;
  --gap: clamp(0.4rem, 1.5vw, 0.9rem);
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(calc(var(--cols) * 2), minmax(0, 1fr));
  grid-auto-rows: auto;
  gap: var(--gap);

  /* centrage, que le parent soit un bloc, un flex ou une grille */
  width: 100%;
  max-width: var(--max);
  margin-inline: auto;
  justify-self: center;
  grid-column: 1 / -1;

  padding: 0.75rem 0.75rem 5rem;
}

.items { display: contents; }

.card {
  margin: 0;
  min-width: 0;
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
  margin-top: 0.35rem;
  font-size: clamp(0.65rem, 1.8vw, 0.85rem);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner {
  grid-column: 1 / -1;
  margin: 0.5rem 0 0;
  padding: 0.6em 1em;
  text-align: center;
  font-size: clamp(0.9rem, 3vw, 1.2rem);
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
  bottom: 1rem;
  padding: 0.6rem 0.9rem;
  font-size: 0.9rem;
  color: #fff;
  background: #222;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10;
}
.fab:hover { background: #444; }
.logout { left: 1rem; }
.reorder { right: 1rem; }
.reorder.active { background: #4a90e2; }

.slot {
  align-self: start;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 2px dashed #888;
  border-radius: 8px;
  color: #888;
  font-size: clamp(0.8rem, 2.5vw, 1.1rem);
  cursor: pointer;
}
.slot.over { border-color: #4a90e2; color: #4a90e2; }
.banner.drop { outline: 2px dashed #4a90e2; outline-offset: 2px; }

</style>