<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import PhotoCarousel from '@/views/PhotoCarousel.vue'
import Countdown from '@/components/Countdown.vue'
import { useRouter } from 'vue-router'

const SLOTS = 12
const ROWS = [1, 4, 7]
const TAIL = 7
const COLS = Math.max(...ROWS, TAIL)
const LABELS = ['Miss France', '5 finalistes', '12 concurrentes']
const MOBILE_MAX = 3

const slots = ref(Array(SLOTS).fill(null)) // 12 emplacements, null = vide
const others = ref([]) // « Les autres »
const selected = ref(null)
const related = ref([])
const user = ref(null)
const router = useRouter()

// --- détection mobile ---
const mobile = ref(false)
let mq = null
const onMq = (e) => (mobile.value = e.matches)

onMounted(() => {
  mq = window.matchMedia('(max-width: 640px)')
  mobile.value = mq.matches
  mq.addEventListener('change', onMq)
})
onUnmounted(() => mq?.removeEventListener('change', onMq))

// --- mode réorganiser (mobile / tactile) ---
const editMode = ref(false)
const picked = ref(null) // { zone, i } de la photo sélectionnée

function toggleEdit() {
  editMode.value = !editMode.value
  picked.value = null
}

async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error(error)
    return
  }
  user.value = null
  router.push('/login')
}

onMounted(async () => {
  const { data: auth } = await supabase.auth.getUser()
  user.value = auth.user

  const [{ data: all }, { data: orders }] = await Promise.all([
    supabase.from('photos').select('*').order('position'),
    // grâce au RLS, seules les lignes de l'utilisateur connecté sont renvoyées
    supabase.from('user_photo_order').select('photo_id, position'),
  ])

  const pos = new Map((orders ?? []).map(o => [o.photo_id, o.position]))
  const sorted = [...(all ?? [])].sort(
    (a, b) =>
      (pos.get(a.id) ?? 1e6 + a.position) - (pos.get(b.id) ?? 1e6 + b.position)
  )

  const s = Array(SLOTS).fill(null)
  const rest = []
  for (const p of sorted) {
    // positions 1 à 12 = emplacements (ordinality commence à 1), 13 et + = « Les autres »
    const k = pos.get(p.id)
    if (k !== undefined && k >= 1 && k <= SLOTS && !s[k - 1]) s[k - 1] = p
    else rest.push(p)
  }
  slots.value = s
  // nouveau compte : toutes les photos sont ici, les 12 cases restent vides
  others.value = rest
})

// Le tableau fait toujours 12 entrées pour les emplacements (null = case vide),
// suivies des « autres ». La fonction SQL ignore les null mais garde leur rang
// (with ordinality) : la position de chaque photo reste donc celle de sa case.
async function saveOrder() {
  if (!user.value) return
  const ids = [
    ...slots.value.map(p => (p ? p.id : null)),
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
  // la photo principale en premier, puis les photos liées
  related.value = [photo.url, ...(data ?? []).map(i => i.url)]
}

// --- placement dans la grille ---

// répartit n éléments en lignes de max `max`, de façon équilibrée (7 -> 3,2,2)
function split(n, max) {
  const lines = Math.ceil(n / max)
  const base = Math.floor(n / lines)
  const extra = n % lines
  return Array.from({ length: lines }, (_, i) => base + (i < extra ? 1 : 0))
}

// n = nombre d'images sur la ligne ; chaque image occupe 2 demi-colonnes
function cell(row, pos, n, cols) {
  const shift = cols - n
  return { gridRow: row, gridColumn: `${shift + pos * 2 + 1} / span 2` }
}

// calcule la position des bandeaux et des 12 emplacements selon l'écran
const layout = computed(() => {
  const max = mobile.value ? MOBILE_MAX : Infinity
  const cols = mobile.value ? MOBILE_MAX : COLS
  const banners = []
  const slotStyle = []
  let row = 1

  ROWS.forEach((n, s) => {
    banners.push({ row, label: LABELS[s] })
    row++
    for (const len of split(n, max)) {
      for (let p = 0; p < len; p++) slotStyle.push(cell(row, p, len, cols))
      row++
    }
  })

  banners.push({ row, label: 'Les autres', other: true })
  return {
    cols,
    banners,
    slotStyle,
    otherStart: row + 1,
    perRow: mobile.value ? MOBILE_MAX : TAIL,
  }
})

function otherPlacement(i) {
  const { cols, otherStart, perRow } = layout.value
  const tailRow = Math.floor(i / perRow)
  const n = Math.min(perRow, others.value.length - tailRow * perRow)
  return cell(otherStart + tailRow, i % perRow, n, cols)
}

const cells = computed(() => [
  ...slots.value.map((photo, i) => ({
    key: 's' + i,
    zone: 'slot',
    i,
    photo,
    style: layout.value.slotStyle[i],
  })),
  ...others.value.map((photo, i) => ({
    key: 'o' + photo.id,
    zone: 'other',
    i,
    photo,
    style: otherPlacement(i),
  })),
])

// --- déplacement (commun au drag souris et au tap mobile) ---
// from / to = { zone, i } ; to.i = null pour le bandeau « Les autres »
function move(from, to) {
  if (!from || (from.zone === to.zone && from.i === to.i)) return

  const s = [...slots.value]
  const o = [...others.value]
  const item = from.zone === 'slot' ? s[from.i] : o[from.i]
  if (!item) return

  if (to.zone === 'slot') {
    const target = s[to.i]
    s[to.i] = item
    if (from.zone === 'slot') s[from.i] = target
    else if (target) o[from.i] = target
    else o.splice(from.i, 1)
  } else if (to.i === null) {
    // déposé sur le bandeau « Les autres »
    if (from.zone === 'other') return
    s[from.i] = null
    o.push(item)
  } else {
    const target = o[to.i]
    if (from.zone === 'slot') {
      s[from.i] = target
      o[to.i] = item
    } else {
      o[from.i] = target
      o[to.i] = item
    }
  }

  slots.value = s
  others.value = o
  saveOrder()
}

// --- drag and drop (ordinateur) ---
const dragFrom = ref(null)
const overKey = ref(null)

function onDragStart(c, e) {
  dragFrom.value = { zone: c.zone, i: c.i }
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', '') // requis par Firefox
}

function resetDrag() {
  dragFrom.value = null
  overKey.value = null
}

function onDrop(to) {
  const from = dragFrom.value
  resetDrag()
  move(from, to)
}

// --- tap (mobile) ---
function onCardClick(c) {
  if (!editMode.value) {
    if (c.photo) openCarousel(c.photo)
    return
  }
  if (!user.value) return
  if (!picked.value) {
    if (c.photo) picked.value = { zone: c.zone, i: c.i }
    return
  }
  const from = picked.value
  picked.value = null
  move(from, { zone: c.zone, i: c.i })
}

// toucher « Les autres » avec une photo sélectionnée
function onBannerTap() {
  if (!editMode.value || !picked.value) return
  const from = picked.value
  picked.value = null
  move(from, { zone: 'other', i: null })
}
</script>

<template>
  <Countdown />

  <div class="grid" :style="{ '--cols': layout.cols }">
    <h2
        v-for="b in layout.banners"
        :key="b.row"
        class="banner"
        :style="{ gridRow: b.row }"
        @click="b.other && onBannerTap()"
        @dragover.prevent
        @drop.prevent="b.other && onDrop({ zone: 'other', i: null })"
    >
      {{ b.label }}
    </h2>

    <div class="items">
      <figure
          v-for="c in cells"
          :key="c.key"
          class="card"
          :class="{
            empty: !c.photo,
            dragging: dragFrom && dragFrom.zone === c.zone && dragFrom.i === c.i,
            over: overKey === c.key,
            picked: picked && picked.zone === c.zone && picked.i === c.i,
          }"
          :style="c.style"
          :draggable="!!user && !!c.photo && !editMode"
          @dragstart="onDragStart(c, $event)"
          @dragover.prevent="overKey = c.key"
          @dragleave="overKey = null"
          @drop.prevent="onDrop({ zone: c.zone, i: c.i })"
          @dragend="resetDrag"
          @click="onCardClick(c)"
      >
        <template v-if="c.photo">
          <img :src="c.photo.url" :alt="c.photo.title" class="thumb" />
          <figcaption class="caption" :title="c.photo.title">
            {{ c.photo.title }}
          </figcaption>
        </template>
        <div v-else class="thumb placeholder"></div>
      </figure>
    </div>
  </div>

  <PhotoCarousel
      v-if="selected"
      :images="related"
      :insta="selected.compte_insta"
      @close="selected = null"
  />

  <button v-if="user" class="logout" @click="logout">Se déconnecter</button>
  <button
      v-if="user"
      class="reorder"
      :class="{ active: editMode }"
      @click="toggleEdit"
  >
    {{ editMode ? 'Terminer' : 'Réorganiser' }}
  </button>
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
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.card.empty {
  cursor: default;
}

.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.placeholder {
  border: 2px dashed #aaa;
  background: rgba(128, 128, 128, 0.08);
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
.picked .thumb { outline: 3px solid #e2574a; outline-offset: 2px; }

.logout,
.reorder {
  position: fixed;
  bottom: 16px;
  padding: 8px 14px;
  font-size: 0.9rem;
  color: #fff;
  background: #222;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10;
}
.logout { left: 16px; }
.reorder { right: 16px; }
.logout:hover,
.reorder:hover { background: #444; }
.reorder.active,
.reorder.active:hover { background: #4a90e2; }

/* mobile : 3 photos max en largeur */
@media (max-width: 640px) {
  .grid {
    --gap: 10px;
    /* 3 photos qui tiennent exactement dans l'écran (#app a 2rem de padding de chaque côté) */
    --size: calc((100vw - 4rem - 2 * var(--gap)) / 3);
  }
  .caption { font-size: 0.7rem; }
}
</style>