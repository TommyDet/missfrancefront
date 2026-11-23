<script setup>
import { ref, onMounted } from 'vue'
import {supabase} from '../lib/supabase.ts'

const rows = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  const { data, error: err } = await supabase
    .from('scores')
    .select('pseudo, score')
    .order('score', { ascending: false })

  if (err) {
    error.value = err.message
  } else {
    let rank = 0
    let prev = null
    rows.value = data.map((r, i) => {
      if (r.score !== prev) {
        rank = i + 1
        prev = r.score
      }
      return { ...r, rank }
    })
  }
  loading.value = false
})
</script>

<template>
  <main class="resultat">
    <h1>Résultats</h1>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="error">Erreur : {{ error }}</p>
    <p v-else-if="!rows.length">Les résultats ne sont pas encore disponibles.</p>

    <table v-else>
      <thead>
        <tr>
          <th>#</th>
          <th>Pseudo</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.pseudo">
          <td>{{ r.rank }}</td>
          <td>{{ r.pseudo }}</td>
          <td>{{ r.score }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.resultat {
  width: min(100%, 40rem);
  margin: 0 auto;
  padding: 1rem;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 0.6rem 0.8rem;
  text-align: left;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}
th:last-child, td:last-child {
  text-align: right;
}
</style>