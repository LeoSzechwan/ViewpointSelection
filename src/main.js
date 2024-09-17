import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ElementPlus from 'element-plus';

const app = createApp(App)

//全局状态
const pinia = createPinia()
app.use(pinia)

app.use(ElementPlus, {
    locale: zhCn,
});

app.mount('#app')