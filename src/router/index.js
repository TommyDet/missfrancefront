import {createRouter, createWebHistory} from 'vue-router'
import App from '@/views/App.vue'
import Login from '@/views/Login.vue'
import Accueil from '@/views/Accueil.vue'

const routes = [
    {
        path: '/',
        component: App
    },
    {
        path: '/login',
        component: Login
    },
    {
        path: '/accueil',
        component: Accueil
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router