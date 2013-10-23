var http = require('http')
var sockjs = require('sockjs')
var sockets = []
var state = {}
var lastUpdate = Date.now()

var ARTIFICIAL_LAG = 1000
var UPDATE_DELAY = 25
var TOR_UPDATE_RATE = 0.5
var VEL_UPDATE_RATE = 5
var WIDTH = 500
var HEIGHT = 500

var echo = sockjs.createServer()
echo.on('connection', function (sock) {
  var id = Math.random().toString().slice(2, 6)

  Object.keys(state).forEach(function (id) {
    sock.write(JSON.stringify({
      cmd: 'create',
      data: state[id]
    }))
  })

  createShip(id)
  sockets.push(sock)

  sock.on('data', function (message) {
    console.log('data', message)

    message = JSON.parse(message)

    setTimeout(function () {
      switch (message.cmd) {
      case 'left':
        left(id)
        break
      case 'right':
        right(id)
        break
      case 'up':
        up(id)
        break
      case 'down':
        down(id)
        break
      }
    }, ARTIFICIAL_LAG)
  })

  sock.on('close', function () {
    sockets.splice(sockets.indexOf(sock), 1)
    setTimeout(function () {
      destroyShip(id)
    }, ARTIFICIAL_LAG)
  })
})

var server = http.createServer()
echo.installHandlers(server, {
  prefix:'/echo'
})
server.listen(9999, '0.0.0.0')

setInterval(updateAll, UPDATE_DELAY)

function broadcast(message) {
  if (typeof message === 'object') {
    message = JSON.stringify(message)
  }

  setTimeout(function () {
    sockets.forEach(function (sock) {
      sock.write(message)
    })
  }, ARTIFICIAL_LAG)
}

function createShip(id) {
  console.log('Creating Ship %s', id)

  state[id] = {
    id: id,
    pos: {
      x: Math.random() * 200,
      y: Math.random() * 200
    },
    vel: {
      x: 0,
      y: 0
    },
    rot: Math.random() * Math.PI,
    tor: 0
  }

  broadcast({
    cmd: 'create',
    data: state[id]
  })
}

function destroyShip(id) {
  console.log('Destroying Ship %s', id)

  broadcast({
    cmd: 'delete',
    data: state[id]
  })

  delete state[id]
}

function updateAll() {
  var duration = Date.now() - lastUpdate
  var seconds = duration / 1000
  var ids = Object.keys(state)

  ids.forEach(function (id) {
    var ship = state[id]
    ship.pos.x += ship.vel.x * seconds
    ship.pos.y += ship.vel.y * seconds
    ship.rot += ship.tor * seconds

    while (ship.pos.x > WIDTH) {
      ship.pos.x -= WIDTH
    }
    while (ship.pos.x < 0) {
      ship.pos.x += WIDTH
    }
    while (ship.pos.y > HEIGHT) {
      ship.pos.y -= HEIGHT
    }
    while (ship.pos.x < 0) {
      ship.pos.y += HEIGHT
    }

    broadcast({
      cmd: 'update',
      data: ship
    })
  })

  lastUpdate += duration
}

function left(id) {
  state[id].tor -= TOR_UPDATE_RATE
}

function right(id) {
  state[id].tor += TOR_UPDATE_RATE
}

function force(rot, amp) {
  var retval = { x: 0, y: 0 }

  retval.x = Math.cos(rot) * amp
  retval.y = Math.sin(rot) * amp

  return retval
}

function down(id) {
  var change = force(state[id].rot, -VEL_UPDATE_RATE)
  state[id].vel.x += change.x
  state[id].vel.y += change.y
}

function up(id) {
  var change = force(state[id].rot, VEL_UPDATE_RATE)
  state[id].vel.x += change.x
  state[id].vel.y += change.y
}
