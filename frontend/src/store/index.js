import Vue from 'vue'
import Vuex from 'vuex'
import * as kanban from './kanban'
import * as ux from './ux'

Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    kanban: {...kanban, namespaced: true},
    ux: {...ux, namespaced: true}
  }
})
