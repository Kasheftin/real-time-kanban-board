<template>
  <v-layout>
    <v-row ref="table" fill-height>
      <v-col
        v-for="column in columns"
        :key="column.id"
        :cols="12 / (columns.length || 1)"
        class="card-column elevation-1"
      >
        <div :data-id="column.id" class="card-list pa-3">
          <v-card v-for="(task, index) in column.tasks" :key="task.id" class="mb-3">
            <v-card-title>{{ task.title }}</v-card-title>
            <v-card-text>{{ task.text }}</v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn icon @click="editTask(task)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-menu top left>
                <template v-slot:activator="{on}">
                  <v-btn icon v-on="on">
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </template>
                <v-list>
                  <v-list-item @click="deleteTask(task, column, index)">
                    <v-list-item-title>Delete</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click.prevent>
                    <v-list-item-title>Cancel</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-card-actions>
          </v-card>
        </div>
        <v-btn fab absolute dark color="pink" class="card-add-button" @click="newTask(column.id)">
          <v-icon>mdi-plus</v-icon>
        </v-btn>
      </v-col>
    </v-row>
    <v-dialog v-model="editTaskOpened" width="500">
      <v-card>
        <v-toolbar color="primary" dark class="mb-6">
          {{ taskInstance.id ? 'Edit Task' : 'Create Task' }}
        </v-toolbar>
        <v-card-text>
          <v-text-field v-model="taskInstance.title" label="Title" />
          <v-text-field v-model="taskInstance.text" label="Text" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editTaskOpened = false">Cancel</v-btn>
          <v-btn text @click="saveTask">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-layout>
</template>

<script>
import axios from 'axios'
import Sortable from 'sortablejs'
import generalFormMixin from '~/mixins/generalFormMixin'

export default {
  mixins: [generalFormMixin],
  data () {
    return {
      columnsCount: 4,
      columns: [],
      editTaskOpened: false,
      taskInstance: {}
    }
  },
  computed: {
    maxDt () { return this.$store.getters['kanban/maxDt'] },
    tasks () { return this.$store.state.kanban.tasks },
    columnsTrigger () { return JSON.stringify(this.tasks.map(task => _.pick(task, 'id', 'col', 'sort', 'updated_at'))) }
  },
  watch: {
    columnsTrigger: {
      immediate: true,
      handler: 'buildColumns'
    }
  },
  created () {
    this.socket = new WebSocket('wss://api.kanban.rag.lt/ws/')
    this.socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        console.log('Socket Message Received', data)
        if (data.type === 'dt' && !isNaN(data.dt) && data.dt > this.maxDt) {
          this.runUpdateQueue()
        }
      } catch (error) {
        console.error('Failed to JSON.parse Socket Message', error, e)
      }
    }
    this.runUpdateQueue()
  },
  beforeDestroy () {
    this._timeout && clearTimeout(this._timeout)
  },
  mounted () {
    this.sortables = this.$refs.table
      .querySelectorAll('.card-list')
      .forEach(column => Sortable.create(column, {
        group: 'columns',
        onEnd: this.dragEnd
      }))
  },
  methods: {
    runUpdateQueue () {
      this._timeout && clearTimeout(this._timeout)
      this.$store
        .dispatch('kanban/loadTasks')
        .then(() => {
          this._timeout = setTimeout(this.runUpdateQueue, 60000)
        })
    },
    buildColumns () {
      const columns = new Array(this.columnsCount).fill(null).map((value, id) => ({id, tasks: []}))
      this.tasks.forEach((task) => {
        if (columns[task.col]) {
          columns[task.col].tasks.push(task)
        }
      })
      this.columns = columns
    },
    dragEnd (e) {
      const oldColumn = parseInt(e.from.dataset.id)
      const newColumn = parseInt(e.to.dataset.id)
      const oldIndex = e.oldIndex
      const newIndex = e.newIndex
      const card = this.columns[oldColumn].tasks.splice(oldIndex, 1)[0]
      this.columns[newColumn].tasks.splice(newIndex, 0, card)
      axios.request({
        method: 'patch',
        url: `/tasks/${card.id}/move`,
        data: {
          col: newColumn,
          updatedAt: card.updated_at,
          beforeId: newIndex ? this.columns[newColumn].tasks[newIndex - 1].id : null
        }
      }).catch((error) => {
        this.handleError(error, {criticalToSnack: true})
        this.buildColumns()
      })
    },
    editTask (task) {
      this.taskInstance = {..._.pick(task, 'id', 'title', 'text'), updatedAt: task.updated_at}
      this.editTaskOpened = true
    },
    newTask (col) {
      this.taskInstance = {title: '', text: '', col}
      this.editTaskOpened = true
    },
    saveTask () {
      this.setLoading(true)
      this.resetAlert()
      this.resetValidationErrors()
      axios.request({
        method: this.taskInstance.id ? 'patch' : 'post',
        url: this.taskInstance.id ? `/tasks/${this.taskInstance.id}` : '/tasks',
        data: this.taskInstance
      }).then(() => {
        this.$snack({type: 'success', text: this.taskInstance.id ? 'Task Updated' : 'New Task Created'})
        this.editTaskOpened = false
      }).catch((error) => {
        this.handleError(error, {criticalToSnack: true})
      }).finally(() => {
        this.setLoading(false)
      })
    },
    deleteTask (task, column, index) {
      column.tasks.splice(index, 1)
      axios.request({
        method: 'delete',
        url: `/tasks/${task.id}`,
        data: {
          updatedAt: task.updated_at
        }
      }).catch((error) => {
        this.handleError(error, {criticalToSnack: true})
        this.buildColumns()
      })
    }
  }
}
</script>

<style lang="scss">
.card-column {
  position: relative;
  display: flex;
  flex-direction: column;
}
.card-list {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow-y: auto;
}
.card-add-button {
  bottom: 20px;
  right: 20px;
}
</style>
