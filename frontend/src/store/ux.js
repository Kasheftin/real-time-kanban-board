export const state = () => ({
  snacks: []
})

export const mutations = {
  showSnack (state, data) {
    const newSnack = {
      id: Date.now(),
      text: 'Saved successfully',
      type: 'success',
      timeout: 6000,
      count: 1,
      ...(data || {})
    }
    newSnack.multiKey = JSON.stringify({text: newSnack.text, type: newSnack.type})
    const existingSnack = state.snacks.find(snack => snack.multiKey === newSnack.multiKey)
    if (existingSnack) {
      existingSnack.count++
      if (existingSnack.timeout) {
        existingSnack.timeout = newSnack.timeout ? newSnack.id + newSnack.timeout - existingSnack.id : 0
      }
    } else {
      state.snacks.push(newSnack)
    }
  },
  hideSnack (state, id) {
    const snackIndex = state.snacks.findIndex(snack => snack.id === id)
    if (snackIndex !== -1) {
      state.snacks.splice(snackIndex, 1)
    }
  },
  hideAllSnacks (state) {
    state.snacks = []
  },
  clearExpiredSnacks (state) {
    if (!state.snacks.length) { return false }
    const dt = Date.now()
    state.snacks = state.snacks.filter(snack => !snack.timeout || (snack.id + snack.timeout > dt))
  }
}

export const actions = {
  showSnack ({commit}, data) {
    commit('showSnack', data)
    return Promise.resolve()
  },
  hideSnack ({commit}, id) {
    commit('hideSnack', id)
    return Promise.resolve()
  },
  hideAllSnacks ({commit}) {
    commit('hideAllSnacks')
    return Promise.resolve()
  },
  clearExpiredSnacks ({commit}) {
    commit('clearExpiredSnacks')
    return Promise.resolve()
  }
}
