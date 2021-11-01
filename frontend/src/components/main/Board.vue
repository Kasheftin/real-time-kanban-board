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
          <v-card
            v-for="(task, index) in column.tasks"
            :key="task.id"
            :color="task.locked ? 'grey lighten-2' : 'white'"
            :class="{'locked': task.locked}"
            class="mb-3"
          >
            <v-card-title>{{ task.title }}</v-card-title>
            <v-card-text>{{ task.text }}</v-card-text>
            <v-card-actions v-if="task.locked">
              <v-spacer />
              <v-btn icon @click="openUnlockRequest(task)">
                <v-icon>mdi-lock</v-icon>
              </v-btn>
            </v-card-actions>
            <v-card-actions v-else>
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
    <v-dialog v-model="unlockRequestOpened" width="400">
      <v-card>
        <v-card-text>
          <div v-if="unlockRequestTarget.locking_requested" class="body-1 pt-6">
            You have asked the owner to give you the edit permission.
            You are going to get the permission in {{ unlockRequestTimeout }} s.
          </div>
          <div v-else class="body-1 pt-6">
            The task is currently edited by someone else.
            You can ask the owner to give you the edit permission.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="unlockRequestOpened = false">Cancel</v-btn>
          <v-btn text v-if="!unlockRequestTarget.locking_requested" @click="sendUnlockRequest">Send Unlock Request</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="incommingRequestOpened" width="400">
      <v-card>
        <v-card-text>
          <div class="body-1 pt-6">
            Someone has requested the permission to edit the task you are currently working on.
            Do you want to cancel your changes and give an access?
            If you'll not give any answer in {{ incommingRequestTimeout }} seconds, the request will be automatically granted.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="denyIncommingUnlockRequest">Deny</v-btn>
          <v-btn text @click="allowIncommingUnlockRequest">Allow</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-layout>
</template>

<script>
import axios from 'axios'
import _ from 'lodash'
import Sortable from 'sortablejs'
import generalFormMixin from '@/mixins/generalFormMixin'

export default {
  mixins: [generalFormMixin],
  data () {
    return {
      columnsCount: 4,
      columns: [],
      editTaskOpened: false,
      taskInstance: {},
      unlockRequestOpened: false,
      unlockRequestTargetId: null,
      unlockRequestTimeout: 0,
      incommingRequestTargetId: null,
      incommingRequestOpened: false,
      incommingRequestTimeout: 0
    }
  },
  computed: {
    maxDt () { return this.$store.getters['kanban/maxDt'] },
    tasks () { return this.$store.state.kanban.tasks },
    unlockRequestTarget () { return this.tasks.find(task => task.id === this.unlockRequestTargetId) || {} },
    columnsTrigger () { return JSON.stringify(this.tasks.map(task => _.pick(task, 'id', 'col', 'sort', 'updated_at'))) },
    editPermissionRequested () {
      const task = this.tasks.find(task => task.edit_permission)
      return task && task.edit_permission_requested_by_someone_else ? task.id : null
    }
  },
  watch: {
    columnsTrigger: {
      immediate: true,
      handler: 'buildColumns'
    },
    editTaskOpened (value) {
      if (this.taskInstance.id) {
        axios.request({
          method: 'patch',
          url: `/tasks/${this.taskInstance.id}/${value ? 'lock' : 'unlock'}`
        }).catch((error) => this.handleError(error, {criticalToSnack: true}))
      }
    },
    unlockRequestOpened (value) {
      if (this.unlockRequestTarget.id && this.unlockRequestTarget.locking_requested && !value) {
        this._unlockTimeout && clearTimeout(this._unlockTimeout)
        axios.request({
          method: 'patch',
          url: `/tasks/${this.unlockRequestTarget.id}/cancel_unlock_request`
        }).catch((error) => this.handleError(error, {criticalToSnack: true}))
      }
    },
    editPermissionRequested: 'runIncommingQueue'
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
    this._unlockTimeout && clearTimeout(this._unlockTimeout)
    this._incommingTimeout && clearTimeout(this._incommingTimeout)
  },
  mounted () {
    this.sortables = this.$refs.table
      .querySelectorAll('.card-list')
      .forEach(column => Sortable.create(column, {
        group: 'columns',
        filter: '.locked',
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
    },
    openUnlockRequest (task) {
      this.unlockRequestTargetId = task.id
      this.unlockRequestOpened = true
    },
    sendUnlockRequest () {
      axios
        .request({
          method: 'patch',
          url: `/tasks/${this.unlockRequestTarget.id}/send_unlock_request`
        })
        .then(() => {
          const run = (n) => {
            this.unlockRequestTimeout = n
            if (n) {
              this._unlockTimeout = setTimeout(() => run(n - 1), 1000)
            } else {
              this.tryUnlock()
            }
            if (n < 5) {
              this.checkIfUnlockAnswerReceived()
            }
          }
          run(5)
        })
        .catch(error => this.handleError(error, {criticalToSnack: true}))
    },
    checkIfUnlockAnswerReceived () {
      if (!this.unlockRequestTarget.id) { return false }
      if (!this.unlockRequestTarget.locked) {
        this._unlockTimeout && clearTimeout(this._unlockTimeout)
        this.editTask(this.unlockRequestTarget)
        this.unlockRequestOpened = false
        this.unlockRequestTargetId = null
        this.$snack({type: 'success', text: 'Permission Granted'})
      } else if (!this.unlockRequestTarget.locking_requested) {
        this._unlockTimeout && clearTimeout(this._unlockTimeout)
        this.unlockRequestOpened = false
        this.unlockRequestTargetId = null
        this.$snack({type: 'error', text: 'Permission Denied'})
      }
    },
    tryUnlock () {
      axios
        .request({
          method: 'patch',
          url: `/tasks/${this.unlockRequestTarget.id}/try_unlock`
        })
        .then(() => {
          this.editTask(this.unlockRequestTarget)
          this.unlockRequestOpened = false
          this.unlockRequestTargetId = null
        })
        .catch(error => this.handleError(error, {criticalToSnack: true}))
    },
    runIncommingQueue (id) {
      this._incommingTimeout && clearTimeout(this._incommingTimeout)
      this.incommingRequestTargetId = id
      this.incommingRequestOpened = !!id
      const task = this.tasks.find(task => task.edit_permission)
      if (!task) {
        // The request was granted by a timeout;
        this.editTaskOpened = false
      }
      if (this.incommingRequestOpened) {
        const run = (n) => {
          this.incommingRequestTimeout = n
          this._incommingTimeout = setTimeout(() => run(n - 1), 1000)
        }
        run(5)
      }
    },
    denyIncommingUnlockRequest () {
      axios
        .request({
          method: 'patch',
          url: `/tasks/${this.incommingRequestTargetId}/deny_unlock`
        })
        .then(() => {
          this.incommingRequestOpened = false
        })
        .catch(error => this.handleError(error, {criticalToSnack: true}))
    },
    allowIncommingUnlockRequest () {
      axios
        .request({
          method: 'patch',
          url: `/tasks/${this.incommingRequestTargetId}/allow_unlock`
        })
        .then(() => {
          this.editTaskOpened = false
          this.incommingRequestOpened = false
        })
        .catch(error => this.handleError(error, {criticalToSnack: true}))
    }
  }
}
</script>

<style>
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
