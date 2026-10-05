import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'

// Interface single-page façon ESPHome Builder : tout (réglages, identifiants,
// journaux, ajout) se fait via des overlays ouverts depuis le dashboard.
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  // Toute ancienne URL profonde retombe sur le dashboard.
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
