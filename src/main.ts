import {createApp} from 'vue'
import './style.css'
import 'normalize.css'
import App from './App.vue'
import store from './stores'

const app = createApp(App)
app.use(store)
app.mount('#app')
