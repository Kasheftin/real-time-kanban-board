import velocity from 'velocity-animate'

export default {
  methods: {
    animHeightBeforeEnter (el) {
      el.style.height = 0
      el.style.overflow = 'hidden'
    },
    animHeightEnter (el, done) {
      setTimeout(() => {
        const targetHeight = el.firstChild.offsetHeight
        velocity(el, {height: targetHeight}, {
          duration: this.duration === null ? 500 : this.duration,
          complete: () => {
            el.style.removeProperty('height')
            el.style.removeProperty('overflow')
            done()
          }
        })
      }, 0)
    },
    animHeightLeave (el, done) {
      el.style.overflow = 'hidden'
      setTimeout(() => {
        velocity(el, {height: 0}, {
          duration: this.duration === null ? 500 : this.duration,
          complete: () => {
            done()
          }
        })
      }, 0)
    }
  }
}
