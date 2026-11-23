import {createRouter, createWebHistory} from 'vue-router'
import {supabase} from '@/lib/supabase'
import Login from '@/views/Login.vue'
import Accueil from '@/views/Accueil.vue'
import Resultat from '@/views/Resultat.vue'

const routes = [
    { path: '/', redirect: '/accueil' },
    { path: '/login', component: Login },
    { path: '/accueil', component: Accueil },
    { path: '/resultat', component: Resultat },
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach(async (to) => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session && to.path !== '/login') return '/login'
    if (session && to.path === '/login') return '/accueil'
})

export default router