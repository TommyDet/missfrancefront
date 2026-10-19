<script setup>
import {supabase} from '../lib/supabase.ts'
import {useRouter} from 'vue-router'
import {onMounted} from "vue";

const router = useRouter()

onMounted(async () => {
  console.log('Ouverture page App')


  const {data} = await supabase.auth.getSession()

  if (!data.session) {
    console.log('User deconnecté')
    router.push('/login')
  }

  console.log('Connecté avant login')
  router.push('/accueil')

})

</script>

<template>
  <router-view />
</template>