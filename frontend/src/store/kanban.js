import axios from 'axios'

export const state = () => ({
  tasks: [],
  initDt: 0
})

export const getters = {
  maxDt (state) {
    return state.tasks.reduce((out, task) => {
      return Math.max(out, task.updated_at)
    }, 0)
  }
}

export const mutations = {
  updateTasks (state, newTasks) {
    const byId = state.tasks.reduce((out, task, index) => {
      out[task.id] = {index, dt: task.updated_at}
      return out
    }, {})
    newTasks.forEach((newTask) => {
      if (byId[newTask.id]) {
        if (byId[newTask.id].dt < newTask.updated_at) {
          state.tasks.splice(byId[newTask.id].index, 1, newTask)
        }
      } else {
        state.tasks.push(newTask)
      }
    })
    state.tasks = state.tasks.sort((t1, t2) => t1.sort - t2.sort)
  },
  deleteTasks (state, deletedTasks) {
    state.tasks = state.tasks.filter(task => !deletedTasks.includes(task.id))
  },
  setInitDt (state, dt) {
    state.initDt = dt
  }
}

export const actions = {
  loadTasks ({state, getters, commit}, force) {
    const dt = force ? 0 : getters.maxDt
    const params = {dt}
    if (dt && state.initDt) {
      params.since = state.initDt
    }
    return axios
      .request({url: '/tasks', params})
      .then((response) => {
        if (!dt) {
          commit('setInitDt', response.data.dt)
        }
        if (response.data.token) {
          axios.defaults.headers.common['x-access-token'] = response.data.token
        }
        commit('updateTasks', response.data.tasks)
        if (response.data.deletedTasks.length) {
          commit('deleteTasks', response.data.deletedTasks)
        }
      })
  }
}
