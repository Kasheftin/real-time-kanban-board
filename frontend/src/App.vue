<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      Kanban Board Test Front End
    </v-app-bar>
    <v-main>
      <v-container fill-height>
        <board />
      </v-container>
    </v-main>
    <snack />
  </v-app>
</template>

<script>
import Snack from '@/components/utils/Snack'
import Board from '@/components/main/Board'

export default {
  components: {Snack, Board}
}
</script>

<style>
html {
  overflow-y: hidden !important;
}
</style>
