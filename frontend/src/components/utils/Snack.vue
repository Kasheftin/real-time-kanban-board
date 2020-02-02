<template>
  <anim-height :group="true" tag="div" class="sis-snack__container">
    <div v-for="snack in snacks" :key="snack.id" class="sis-snack__item v-snack--multi-line">
      <div :class="getSnackType(snack)" class="v-snack__wrapper sis-snack__wrapper">
        <div class="v-snack__content sis-snack__content">
          <div v-if="snack.textIsArray">
            <div v-for="text in snack.text" :key="text">
              {{ text }}
            </div>
          </div>
          <span v-else>
            {{ snack.text }}
          </span>
          <div v-if="snack.count > 1 || snack.buttons && snack.buttons.length">
            <v-chip v-if="snack.count > 1">
              {{ snack.count }}
            </v-chip>
            <v-btn v-for="button in snack.buttons" :key="button.text" dark text @click.stop.prevent="triggerButtonAction(button, snack)">
              {{ button.text }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </anim-height>
</template>

<script>
import AnimHeight from './AnimHeight'

export default {
  components: {AnimHeight},
  computed: {
    snacks () {
      return this.$store.state.ux.snacks.map(snack => ({
        ...snack,
        textIsArray: _.isArray(snack.text),
        buttons: [...(snack.buttons || []), {text: 'Close', action: 'hide'}]
      }))
    }
  },
  created () {
    this.runTimeoutWatcher()
  },
  beforeDestroy () {
    this._timeout && clearTimeout(this._timeout)
  },
  methods: {
    getSnackType (snack) {
      if (snack.success) { return 'success' }
      if (snack.error) { return 'error' }
      if (snack.info) { return 'info' }
      if (snack.warning) { return 'warning' }
      if (snack.color) { return snack.color }
      if (snack.type) { return snack.type }
      return 'success'
    },
    triggerButtonAction (button, snack) {
      if (button.action === 'hide') {
        return this.$store.dispatch('ux/hideSnack', snack.id)
      } else if (_.isFunction(button.action)) {
        return button.action()
      }
    },
    runTimeoutWatcher () {
      if (this.$store.state.ux.snacks.length) {
        this.$store.dispatch('ux/clearExpiredSnacks')
      }
      this._timeout = setTimeout(this.runTimeoutWatcher, 1000)
    }
  }
}
</script>

<style lang="scss">
.sis-snack__container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 202;
}
.sis-snack__wrapper {
  margin-bottom: 10px;
  font-size: 14px;
  color: #fff;
  font-weight: bold;
}
</style>
