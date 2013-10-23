var http = require('http')
var sockjs = require('sockjs')
var sendFunctions = []
var state = {}
var lastUpdate = Date.now()

var MAX_ARTIFICIAL_LAG = 200
var UPDATE_DELAY = 25
var TOR_UPDATE_RATE = 0.5
var VEL_UPDATE_RATE = 5
var WIDTH = 500
var HEIGHT = 500

var asteroids = sockjs.createServer()
asteroids.on('connection', function (sock) {
  var id = Math.random().toString().slice(2, 6)
  var lag = Math.random() * MAX_ARTIFICIAL_LAG

  console.log('New ship %s has lag %sms', id, lag)

  function send(data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data)
    }

    setTimeout(function () {
      sock.write(data)
    }, lag)
  }

  Object.keys(state).forEach(function (id) {
    send({
      cmd: 'create',
      data: state[id]
    })
  })

  sendFunctions.push(send)
  createShip(id)

  sock.on('data', function (message) {
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
    }, lag)
  })

  sock.on('close', function () {
    sendFunctions.splice(sendFunctions.indexOf(send), 1)
    destroyShip(id)
  })
})

var server = http.createServer()
asteroids.installHandlers(server, {
  prefix:'/asteroids'
})
server.listen(9999, '0.0.0.0')

setInterval(updateAll, UPDATE_DELAY)

function broadcast(message) {
  sendFunctions.forEach(function (send) {
    send(message)
  })
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
