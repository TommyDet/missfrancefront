<script setup>
import {onMounted, ref} from 'vue'
import {supabase} from '@/lib/supabase'
import {useRouter} from 'vue-router'

const todos = ref([])
const router = useRouter()

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

const logout = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error(error)
    return
  }

  router.push('/login')
}

</script>

<template>
  <ul>
    <li v-for="project in todos" :key="project.id">
      {{ project.name }}
    </li>
  </ul>
  <div>
    <h1>Accueil</h1>

    <button @click="logout">
      Déconnexion
    </button>
  </div>
</template>