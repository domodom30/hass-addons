import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'
import { startHaThemeSync } from './plugins/haTheme'
import { createI18n } from './i18n'

const i18n = createI18n()
const app = createApp(App)

app.use(router)
app.use(store)
app.use(vuetify)
startHaThemeSync(vuetify)
app.use(i18n)
app.mount('#app')
