<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      Kanban Board Test Front End
    </v-app-bar>
    <v-content>
      <v-container>
        <v-layout>
          {{ tasks }}
        </v-layout>
      </v-container>
    </v-content>
  </v-app>
</template>

<script>

export default {
  data () {
    return {
      rows: 4
    }
  },
  computed: {
    maxDt () { return this.$store.getters['kanban/maxDt'] },
    tasks () { return this.$store.state.kanban.tasks }
  },
  created () {
    this.socket = new WebSocket('ws://kanban.rag.lt/?group=dt')
    this.socket.onmessage = (e) => {
      if (!isNaN(e.data) && e.data > this.maxDt) {
        this.runUpdateQueue()
      }
    }
    this.runUpdateQueue()
  },
  methods: {
    runUpdateQueue () {
      this._timeout && clearTimeout(this._timeout)
      this.$store
        .dispatch('kanban/loadTasks')
        .then(() => {
          this._timeout = setTimeout(this.runUpdateQueue, 60000)
        })
    }
  }
}
</script>
