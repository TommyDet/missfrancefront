<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {supabase} from '@/lib/supabase.ts'

const email = ref('')
const password = ref('')
const errorMessage = ref('')

const router = useRouter()

const login = async () => {
  console.log('Ouverture page Login')

  errorMessage.value = ''

  const {error} = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  if (error) {
    errorMessage.value = error.message
    return
  }

  console.log('Connecté')
  router.push('/accueil')
}
</script>

<template>
  <div class="login-container">
    <h1>Connexion</h1>

    <form @submit.prevent="login">
      <input
          v-model="email"
          placeholder="Email"
          type="email"
      />

      <input
          v-model="password"
          placeholder="Mot de passe"
          type="password"
      />

      <button type="submit">
        Se connecter
      </button>
    </form>

    <p v-if="errorMessage" style="color:red">
      {{ errorMessage }}
    </p>
  </div>
</template>