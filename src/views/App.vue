<script setup>
import {supabase} from '../lib/supabase.ts'
import {useRouter} from 'vue-router'
import {onMounted} from "vue";

const router = useRouter()

onMounted(async () => {
  console.log('Ouverture page App')

  router.push('/login')

})

</script>

<template>
  <router-view />
</template>