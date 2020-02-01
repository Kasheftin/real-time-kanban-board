import axios from 'axios'

export const state = () => ({
  tasks: []
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
      out[task.id] = { index, dt: task.updated_at }
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
  }
}

export const actions = {
  loadTasks ({getters, commit}) {
    return axios
      .request({url: '/tasks', params: {dt: getters.maxDt}})
      .then(response => commit('updateTasks', response.data))
  }
}
