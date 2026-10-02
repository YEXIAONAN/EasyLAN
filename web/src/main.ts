import { createApp } from "vue";
import App from "./App.vue";
import { initializeLocale } from "./i18n";
import "./styles.css";

initializeLocale();
createApp(App).mount("#app");
