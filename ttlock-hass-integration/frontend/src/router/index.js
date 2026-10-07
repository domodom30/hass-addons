import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Activity from '../views/Activity.vue'

// Interface façon ESPHome Builder : réglages, identifiants et ajout se font via
// des overlays ouverts depuis le dashboard ; le journal d'activité a sa propre vue.
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/activity/:address?',
    name: 'Activity',
    component: Activity
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
