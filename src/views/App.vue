<script setup>
import {supabase} from '../lib/supabase.ts'
import {useRouter} from 'vue-router'

const router = useRouter()

router.beforeEach(async (to) => {

  console.log('Ouverture page App')

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session && to.path !== '/login') {
    return '/login'
  }

  if (session && to.path === '/login') {
    return '/accueil'
  }
})

</script>

<template>
  <router-view />
</template>