<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import PhotoCarousel from '@/views/PhotoCarousel.vue'
import Countdown from '@/components/Countdown.vue'
import { useRouter } from 'vue-router'

const SLOTS = 12
const ROWS = [1, 4, 7]
const TAIL = 7
const COLS = Math.max(...ROWS, TAIL)

const slots = ref(Array(SLOTS).fill(null)) // 12 emplacements, null = vide
const others = ref([]) // « Les autres »
const selected = ref(null)
const related = ref([])
const user = ref(null)
const router = useRouter()

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

// n = nombre d'images sur la ligne ; chaque image occupe 2 demi-colonnes
function cell(row, pos, n) {
  const shift = COLS - n
  return { gridRow: row, gridColumn: `${shift + pos * 2 + 1} / span 2` }
}

function slotPlacement(index) {
  let start = 0
  for (let r = 0; r < ROWS.length; r++) {
    if (index < start + ROWS[r]) return cell(r * 2 + 2, index - start, ROWS[r])
    start += ROWS[r]
  }
}

function otherPlacement(i) {
  const tailRow = Math.floor(i / TAIL)
  const n = Math.min(TAIL, others.value.length - tailRow * TAIL)
  return cell(ROWS.length * 2 + 2 + tailRow, i % TAIL, n)
}

const cells = computed(() => [
  ...slots.value.map((photo, i) => ({
    key: 's' + i,
    zone: 'slot',
    i,
    photo,
    style: slotPlacement(i),
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

  <div class="grid" :style="{ '--cols': COLS }">
    <h2 class="banner" style="grid-row: 1">Miss France</h2>
    <h2 class="banner" style="grid-row: 3">5 finalistes</h2>
    <h2 class="banner" style="grid-row: 5">12 concurrentes</h2>
    <h2
        class="banner"
        style="grid-row: 7"
        @click="onBannerTap"
        @dragover.prevent
        @drop.prevent="onDrop({ zone: 'other', i: null })"
    >
      Les autres
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
</style>