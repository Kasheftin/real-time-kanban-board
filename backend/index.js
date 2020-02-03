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
  PRIMARY KEY (`id`), INDEX(`updated_at`), INDEX(`sort`), INDEX(`deleted_at`)) ENGINE = InnoDB;
*/

const app = require('express')()
const server = require('http').Server(app)
const bodyParser = require('body-parser')
const mysql = require('mysql2')
const WebSocket = require('ws')
const wss = new WebSocket.Server({port: process.env.SOCKET_PORT})

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

app.get('/tasks', async (req, res) => {
  const dt = (new Date).getTime()
  const [tasks] = await db.query('select * from tasks where updated_at>? and deleted_at=0 order by sort', [req.query.dt || 0])
  let deletedTasks = []
  if (req.query.since) {
    const rows = await db.query('select id from tasks where deleted_at>?', [req.query.since])
    deletedTasks = rows[0].map(item => item.id)
  }
  res.send({tasks, dt, deletedTasks})
})

app.post('/tasks', async (req, res) => {
  try {
    if (!req.body.title || !req.body.text) {
      return res.status(400).send({error: 'Title and Text fields must be filled'})
    }
    const dt = (new Date).getTime()
    const [result] = await db.query(
      'insert into tasks(title,text,col,created_at,updated_at) values(?,?,?,?,?)',
      [req.body.title, req.body.text, req.body.col, dt, dt]
    )
    if (!result.insertId) {
      console.log(result)
      throw new Error('Failed to create new task in DB')
    }
    await db.query('update tasks set sort=? where id=?', [result.insertId * 1000, result.insertId])
    const wssMessage = JSON.stringify({type: 'dt', dt})
    wss.clients.forEach((ws) => ws.send(wssMessage))
    res.send()
  } catch (error) {
    console.error(error)
    res.status(500).send({error: error.message})
  }
})

app.patch('/tasks/:id', async (req, res) => {
  try {
    if (!req.body.title || !req.body.text) {
      return res.status(400).send({error: 'Title and Text fields must be filled'})
    }
    const [[task]] = await db.query('select id,updated_at from tasks where id=? and deleted_at=0', [req.params.id])
    if (!task) {
      return res.status(404).send()
    }
    if (task.updated_at !== req.body.updatedAt) {
      return res.status(400).send({error: 'You are trying to update not a recent version of this task'})
    }
    const dt = (new Date).getTime()

    await db.query(`
      update tasks set title=?,text=?,updated_at=?
      where id=?
    `, [req.body.title, req.body.text, dt, req.params.id])
    const wssMessage = JSON.stringify({type: 'dt', dt})
    wss.clients.forEach((ws) => ws.send(wssMessage))
    res.send()
  } catch (error) {
    console.error(error)
    res.status(500).send({error: error.message})
  }
})

app.delete('/tasks/:id', async (req, res) => {
  try {
    const [[task]] = await db.query('select id,updated_at from tasks where id=? and deleted_at=0', [req.params.id])
    if (!task) {
      return res.status(404).send()
    }
    if (task.updated_at !== req.body.updatedAt) {
      return res.status(400).send({error: 'You are trying to update not a recent version of this task'})
    }
    const dt = (new Date).getTime()

    await db.query('update tasks set updated_at=?,deleted_at=? where id=?', [dt, dt, req.params.id])
    const wssMessage = JSON.stringify({type: 'dt', dt})
    wss.clients.forEach((ws) => ws.send(wssMessage))
    res.send()
  } catch (error) {
    console.error(error)
    res.status(500).send({error: error.message})
  }
})

app.patch('/tasks/:id/move', async (req, res) => {
  const [[task]] = await db.query('select id,updated_at from tasks where id=?', [req.params.id])
  if (!task) {
    return res.status(404).send()
  }
  if (task.updated_at !== req.body.updatedAt) {
    console.log(task, req.body)
    return res.status(400).send({error: 'You are trying to update not a recent version of this task'})
  }
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
        console.error('Unable to sort after align')
        return res.status(500).send({error: 'Unable to sort after align'})
      } else {
        await alignSort()
        await run(true)
      }
    } else {
      await db.query('update tasks set sort=?,col=?,updated_at=? where id=?', [sort, req.body.col, dt, task.id])
      const wssMessage = JSON.stringify({type: 'dt', dt})
      wss.clients.forEach((ws) => ws.send(wssMessage))
      res.send()
    }
  }

  try {
    await run()
  } catch (error) {
    console.error(error)
    res.status(500).send({error: error.message})
  }
})

server.listen(process.env.PORT)
