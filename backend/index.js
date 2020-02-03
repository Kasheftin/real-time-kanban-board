/*
CREATE TABLE `tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` TEXT NOT NULL,
  `text` TEXT NOT NULL,
  `sort` INT NOT NULL DEFAULT '0',
  `col` INT NOT NULL DEFAULT '0',
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  `deleted_at` BIGINT NOT NULL DEFAULT '0',
  `locked_by` VARCHAR(255) DEFAULT '',
  `locked_at` BIGINT NOT NULL DEFAULT '0',
  `locking_switch_requested_by` VARCHAR(255) DEFAULT '',
  `locking_switch_requested_at` BIGINT NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`), INDEX(`updated_at`), INDEX(`sort`), INDEX(`deleted_at`)) ENGINE = InnoDB;
*/

const app = require('express')()
const server = require('http').Server(app)
const bodyParser = require('body-parser')
const mysql = require('mysql2')
const WebSocket = require('ws')
const wss = new WebSocket.Server({port: process.env.SOCKET_PORT})
const uniqid = require('uniqid')
const _ = require('lodash')
const StatusError = require('./StatusError')

wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(/\s*,\s*/)[0]
  console.log('New Client Connected from ' + ip)
  ws.send(JSON.stringify({type: 'connected', message: 'New Client Connected from ' + ip}))
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

const db = mysql.createConnection({
  host: 'localhost',
  user: 'kanban',
  password: 'AEb9NZE6AF7sswA0',
  database: 'kanban'
}).promise()

const checkIfTaskIsEditable = async (id, req) => {
  const [[task]] = await db.query('select * from tasks where id=? and deleted_at=0', [id])
  if (!task) {
    throw new StatusError('Task Not Found', 404)
  }
  if (task.locked_by && task.locked_by !== req.headers['x-access-token']) {
    throw new StatusError('The task is currently edited by someone else', 400)
  }
  return task
}

const wssSendDt = (dt) => {
  const wssMessage = JSON.stringify({type: 'dt', dt})
  wss.clients.forEach((ws) => ws.send(wssMessage))
}

app.get('/tasks', async (req, res) => {
  const token = req.headers['x-access-token'] || uniqid()
  const dt = (new Date).getTime()

  const result = await db.query('select * from tasks where updated_at>? and deleted_at=0 order by sort', [req.query.dt || 0])
  const tasks = result[0].map(item => ({
    ..._.omit(item, 'locked_by', 'locking_switch_requested_by'),
    locked: !!(item.locked_by && item.locked_by !== token),
    locking_requested: item.locking_switch_requested_by === token,
    edit_permission: item.locked_by === token,
    edit_permission_requested_by_someone_else: item.locked_by === token && !!item.locking_switch_requested_by
  }))

  let deletedTasks = []
  if (req.query.since) {
    const rows = await db.query('select id from tasks where deleted_at>?', [req.query.since])
    deletedTasks = rows[0].map(item => item.id)
  }

  res.send({tasks, dt, token, deletedTasks})
})

app.post('/tasks', async (req, res) => {
  try {
    if (!req.body.title || !req.body.text) {
      throw new StatusError('Title and Text fields must be filled', 400)
    }
    const dt = (new Date).getTime()
    const [result] = await db.query(
      'insert into tasks(title,text,col,created_at,updated_at) values(?,?,?,?,?)',
      [req.body.title, req.body.text, req.body.col, dt, dt]
    )
    if (!result.insertId) {
      throw new StatusError('Failed to create new task in DB', 500)
    }
    await db.query('update tasks set sort=? where id=?', [result.insertId * 1000, result.insertId])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id', async (req, res) => {
  try {
    if (!req.body.title || !req.body.text) {
      throw new StatusError('Title and Text fields must be filled', 400)
    }
    const task = await checkIfTaskIsEditable(req.params.id, req)
    const dt = (new Date).getTime()
    await db.query('update tasks set title=?,text=?,updated_at=? where id=?', [req.body.title, req.body.text, dt, task.id])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await checkIfTaskIsEditable(req.params.id, req)
    const dt = (new Date).getTime()
    await db.query('update tasks set updated_at=?,deleted_at=? where id=?', [dt, dt, req.params.id])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/move', async (req, res) => {
  const task = await checkIfTaskIsEditable(req.params.id, req)
  const dt = (new Date).getTime()

  const alignSort = async () => {
    const [tasks] = await db.query('select id,sort from tasks order by sort')
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].sort !== (i + 1) * 1000) {
        await db.query('update tasks set sort=?,updated_at=? where id=?', [(i + 1) * 1000, dt, tasks[i].id])
      }
    }
  }

  const run = async (repeat) => {
    const [[beforeTask]] = await db.query('select * from tasks where id=?', [req.body.beforeId])
    const sortMin = (beforeTask || {}).sort || 0
    const [[afterTask]] = await db.query('select * from tasks where sort>? and id!=? order by sort limit 0,1', [sortMin, task.id])
    const sortMax = afterTask ? afterTask.sort : Math.ceil((sortMin + 1) / 1000) * 1000
    const sort = Math.floor((sortMin + sortMax) / 2)
    if (sort === sortMin || sort === sortMax) {
      if (repeat) {
        throw new StatusError('Unable to sort after align', 500)
      } else {
        await alignSort()
        await run(true)
      }
    } else {
      await db.query('update tasks set sort=?,col=?,updated_at=? where id=?', [sort, req.body.col, dt, task.id])
      wssSendDt(dt)
      res.send()
    }
  }

  try {
    await run()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/lock', async (req, res) => {
  try {
    const task = await checkIfTaskIsEditable(req.params.id, req)
    console.log('task lock ok', task, req.headers['x-access-token'])
    const dt = (new Date).getTime()
    await db.query('update tasks set locked_by=?,locked_at=?,updated_at=? where id=?', [req.headers['x-access-token'], dt, dt, task.id])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/unlock', async (req, res) => {
  try {
    const [[task]] = await db.query('select * from tasks where id=? and deleted_at=0', [req.params.id])
    if (task && task.locked_by === req.headers['x-access-token']) {
      const dt = (new Date).getTime()
      await db.query('update tasks set locked_by="",locked_at=0,updated_at=? where id=?', [dt, task.id])
      wssSendDt(dt)
    }
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/send_unlock_request', async (req, res) => {
  try {
    const [[task]] = await db.query('select * from tasks where id=? and deleted_at=0', [req.params.id])
    if (!task) {
      throw new StatusError('Task Not Found', 404)
    }
    if (!task.locked_by || task.locked_by === req.headers['x-access-token']) {
      throw new StatusError('The task is not locked', 400)
    }
    if (task.locking_switch_requested_by === req.headers['x-access-token']) {
      throw new StatusError('You have already asked for the edit permission', 400)
    }
    const dt = (new Date).getTime()
    await db.query('update tasks set locking_switch_requested_by=?,locking_switch_requested_at=?,updated_at=? where id=?', [req.headers['x-access-token'], dt, dt, req.params.id])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/cancel_unlock_request', async (req, res) => {
  try {
    const [[task]] = await db.query('select * from tasks where id=? and deleted_at=0', [req.params.id])
    if (!task) {
      throw new StatusError('Task Not Found', 404)
    }
    if (task.locking_switch_requested_by === req.headers['x-access-token']) {
      const dt = (new Date).getTime()
      await db.query('update tasks set locking_switch_requested_by="",locking_switch_requested_at=0,updated_at=? where id=?', [dt, req.params.id])
      wssSendDt(dt)
    }
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/try_unlock', async (req, res) => {
  try {
    const [[task]] = await db.query('select * from tasks where id=? and deleted_at=0', [req.params.id])
    if (!task) {
      throw new StatusError('Task Not Found', 404)
    }
    if (task.locking_switch_requested_by === req.headers['x-access-token']) {
      const dt = (new Date).getTime()
      if (dt > task.locking_switch_requested_at + 5000) {
        await db.query(
          'update tasks set locking_switch_requested_by="",locking_switch_requested_at=0,locked_by=?,locked_at=?,updated_at=? where id=?',
          [req.headers['x-access-token'], dt, dt, req.params.id]
        )
        wssSendDt(dt)
      } else {
        throw new StatusError('You have to wait for 5 seconds before getting the edit permission', 400)
      }
    } else {
      throw new StatusError('Someone else also asked for the edit permission, your request was cancelled', 400)
    }
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/deny_unlock', async (req, res) => {
  try {
    const task = await checkIfTaskIsEditable(req.params.id, req)
    const dt = (new Date).getTime()
    await db.query('update tasks set locking_switch_requested_by="",locking_switch_requested_at=0,updated_at=? where id=?', [dt, task.id])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

app.patch('/tasks/:id/allow_unlock', async (req, res) => {
  try {
    const task = await checkIfTaskIsEditable(req.params.id, req)
    const dt = (new Date).getTime()
    await db.query('update tasks set locked_by=?,locked_at=?,locking_switch_requested_by="",locking_switch_requested_at=0,updated_at=? where id=?', [dt.locking_switch_requested_by, dt, dt, task.id])
    wssSendDt(dt)
    res.send()
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).send({error: error.message})
  }
})

server.listen(process.env.PORT)
