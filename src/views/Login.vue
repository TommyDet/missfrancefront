<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {supabase} from '@/lib/supabase.ts'

const FAKE_EMAIL_DOMAIN = 'monsite.app'

const pseudo = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const router = useRouter()

const pseudoToEmail = (value) =>
    `${value.trim().toLowerCase()}@${FAKE_EMAIL_DOMAIN}`

const login = async () => {
  errorMessage.value = ''

  if (!pseudo.value.trim() || password.value.length < 6) {
    errorMessage.value = 'Pseudo requis et mot de passe de 6 caractères minimum'
    return
  }

  loading.value = true
  const email = pseudoToEmail(pseudo.value)

  // 1. Tentative de connexion
  const {error: signInError} = await supabase.auth.signInWithPassword({
    email,
    password: password.value
  })

  if (!signInError) {
    loading.value = false
    router.push('/accueil')
    return
  }

  if (signInError.code !== 'invalid_credentials') {
    loading.value = false
    errorMessage.value = signInError.message
    return
  }

  // 2. Échec : compte inexistant ou mauvais mot de passe -> on tente la création
  const {data, error: signUpError} = await supabase.auth.signUp({
    email,
    password: password.value
  })

  loading.value = false

  if (signUpError) {
    // Le compte existe déjà, donc c'était le mot de passe qui était faux
    errorMessage.value = signUpError.code === 'user_already_exists'
        ? 'Pseudo ou mot de passe incorrect'
        : signUpError.message
    return
  }

  if (data.session) {
    router.push('/accueil')
  } else {
    errorMessage.value = 'Compte créé mais non confirmé : désactivez "Confirm email" dans Supabase'
  }
}
</script>

<template>
  <div class="login-container">
    <h1>Connexion</h1>

    <form @submit.prevent="login">
      <input
          v-model="pseudo"
          placeholder="Pseudo"
          type="text"
          autocomplete="username"
      />

      <input
          v-model="password"
          placeholder="Mot de passe"
          type="password"
          autocomplete="current-password"
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