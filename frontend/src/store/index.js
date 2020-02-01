import Vue from 'vue'
import Vuex from 'vuex'
import * as kanban from './kanban'

Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    kanban: {...kanban, namespaced: true}
  }
})
