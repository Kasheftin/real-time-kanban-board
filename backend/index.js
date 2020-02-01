/*
CREATE TABLE `tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` TEXT NOT NULL,
  `text` TEXT NOT NULL,
  `order` INT NOT NULL DEFAULT '0',
  `column` INT NOT NULL DEFAULT '0',
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`), INDEX(`updated_at`)) ENGINE = InnoDB;
*/

const app = require('express')()
const server = require('http').Server(app)
const io = require('socket.io')(server, {path: '/ws/'})
const bodyParser = require('body-parser')
const mysql = require('mysql2')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

const db = mysql.createConnection({
  host: 'localhost',
  user: 'kanban',
  password: 'AEb9NZE6AF7sswA0',
  database: 'kanban'
}).promise()

app.get('/tasks', async (req, res) => {
  const [tasks] = await db.query('select * from tasks where updated_at>?', [req.query.dt || 0])
  io.emit('test', {test: 'test'})
  res.send(tasks)
})

app.post('/tasks', async (req, res) => {
  if (!req.query.title || !req.query.text) {
    res.status(400).send({error: 'Title and Text fields must be filled'})
  }
  const dt = (new Date).getTime()
  await db.query(`
    insert into tasks(title, text, created_at, updated_at)
    values(?,?,?,?)')
  `, [req.body.title, req.body.text, dt, dt])
  io.emit('dt', dt)
  res.status(200)
})

app.get('/tasks/:id', async (req, res) => {
  const [[task]] = await db.query('select * from tasks where id=?', [req.params.id])
  if (!task) {
    res.status(404)
  } else {
    res.send(task)
  }
})

app.patch('/tasks/:id', async (req, res) => {
  const [[task]] = await db.query('select * from tasks where id=?', [req.params.id])
  if (!task) { return res.status(404) }
  if (!req.query.title || !req.query.text) {
    res.status(400).send({error: 'Title and Text fields must be filled'})
  }
  const dt = (new Date).getTime()
  await db.query(`
update tasks set title=?, text=?, updated_at=?
where id=?
  `, [req.body.title, req.body.text, dt, req.params.id])
  io.emit('dt', dt)
  res.status(200)
})


server.listen(parseInt(process.env.PORT, 10) || 8000)
