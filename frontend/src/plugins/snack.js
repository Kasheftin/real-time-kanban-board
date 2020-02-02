import Vue from 'vue'

const snack = function (data) {
  if (data === 'hide') {
    this.$store.dispatch('ux/hideAllSnacks')
  } else if (_.isString(data)) {
    this.$store.dispatch('ux/showSnack', {text: data})
  } else {
    this.$store.dispatch('ux/showSnack', data)
  }
}

const VueSnack = function () {
}

VueSnack.install = function (Vue) {
  Vue.snack = snack
  if (!Object.prototype.hasOwnProperty.call(Vue, '$snack')) {
    Object.defineProperty(Vue.prototype, '$snack', {
      get () {
        return snack
      }
    })
  }
}

Vue.use(VueSnack)
