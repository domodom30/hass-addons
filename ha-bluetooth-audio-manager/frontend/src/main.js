// Vendored Bootstrap + Font Awesome CSS (bundled, no CDN — works offline).
// We deliberately do NOT import Bootstrap's JS bundle: modals, toasts and
// dropdowns are reimplemented as Vue components driven by reactive state.
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./style.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
