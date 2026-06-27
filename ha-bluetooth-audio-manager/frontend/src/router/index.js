import { createRouter, createWebHashHistory } from "vue-router";
import Home from "../views/Home.vue";

// Single-page dashboard (ESPHome-style): device grid on Home, everything else
// (settings, adapters, events, logs) opens as an overlay. Hash history keeps
// routing entirely client-side, which is required under the HA ingress proxy.
const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
