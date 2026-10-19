<script setup>
import {onMounted, ref} from 'vue'
import {supabase} from '@/lib/supabase'

const todos = ref([])

onMounted(async () => {

  console.log('Ouverture page Accueil')

  const {data, error} = await supabase
      .from('todos')
      .select('*')

  if (error) {
    console.log('Une erreur est survenue')
  } else {
    console.log('Requete Ok')
  }

  todos.value = data
})
</script>

<template>
  <ul>
    <li v-for="project in todos" :key="project.id">
      {{ project.name }}
    </li>
  </ul>
</template>