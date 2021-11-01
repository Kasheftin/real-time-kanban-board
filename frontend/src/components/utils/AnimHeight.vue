<template>
  <component :is="component" v-bind="attrsComputed" v-on="listenersComputed">
    <slot />
  </component>
</template>

<script>
import animHeight from '@/utils/anim_height'

export default {
  mixins: [animHeight],
  props: {
    group: {
      type: Boolean,
      default: false
    },
    duration: {
      type: [Number, Object],
      default: null
    }
  },
  computed: {
    attrsComputed () {
      return {
        css: false,
        ...this.$attrs
      }
    },
    listenersComputed () {
      return {
        beforeEnter: this.animHeightBeforeEnter,
        enter: this.animHeightEnter,
        leave: this.animHeightLeave,
        ...this.$listeners
      }
    },
    component () {
      return this.group ? 'transition-group' : 'transition'
    }
  }
}
</script>
