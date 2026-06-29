import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";
import { i18n } from "./i18n";

const app = createApp(App);

app.use(router);
app.use(store);
app.use(vuetify);
app.use(i18n);
app.mount("#app");
