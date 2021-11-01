import Vue from 'vue'
import axios from 'axios'
import App from './App.vue'
import store from './store'
import vuetify from '@/plugins/vuetify'
import '@/plugins/swal'
import '@/plugins/snack'

axios.defaults.baseURL = 'https://api.kanban.rag.lt'

Vue.config.productionTip = false

new Vue({
  store,
  vuetify,
  render: h => h(App)
}).$mount('#app')
