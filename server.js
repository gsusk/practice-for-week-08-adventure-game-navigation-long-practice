const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

function itemsAux(items) {
  console.log(items);
  let itemsText = '';
  for (const obj of items) {
    itemsText += `${obj.name}: ${obj.description} \n`
  }
  return itemsText
}

const server = http.createServer((req, res) => {
  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === 'GET' && req.url === '/') {
      let file = fs.readFileSync('./views/new-player.html', 'utf-8');
      let newFile = file.replace(/#{availableRooms}/, world.availableRoomsToString());
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      return res.end(newFile)
    }
    // Phase 2: POST /player
    if (req.method === 'POST' && req.url === '/player') {
      let { name, roomId } = req.body;
      const startingRoom = world.rooms[roomId]
      let newPlayer = new Player(name, startingRoom);
      player = newPlayer;
      res.statusCode = 302;
      res.setHeader('Location', `/rooms/${roomId}`);
      return res.end();
    }

    if (!player) {
      res.statusCode = 302;
      res.setHeader('Location', `/`);
      return res.end();
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === 'GET' && req.url.startsWith('/rooms/')) {
      let splitUrl = req.url.split('/');
      if (splitUrl.length === 3) {
        const currentRoomId = splitUrl[2];
        if (Number(currentRoomId) !== player.currentRoom.id) {
          console.log('Redirecting...');
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
          return res.end()
        }

        const file = fs.readFileSync('./views/room.html', 'utf-8');
        const newFile = file
          .replace(/#{roomName}/g, player.currentRoom.name)
          .replace(/#{inventory}/g, `${player.items.join(', ')}`)
          .replace(/#{roomItems}/, `${itemsAux(player.currentRoom.items)}`)
          .replace(/#{exits}/, `${Object.keys(player.currentRoom.exits)}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        return res.end(newFile);
      }
    }
    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === 'GET' && req.url.startsWith('/rooms/')) {

      let splitUrl = req.url.split('/');
      if (splitUrl.length === 4) {
        const currentRoomId = splitUrl[2];
        if (Number(currentRoomId) !== player.currentRoom.id) {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
          return res.end()
        }

        try {
          const direction = splitUrl[3];
          player.move(direction.charAt(0));
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${player.currentRoom.id}`)
          return res.end()
        } catch (err) {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${currentRoomId}`)
          return res.end()
        }
      }
    }
    // Phase 5: POST /items/:itemId/:action
    if (req.method === 'POST' && req.url.startsWith('/items/')) {
      let splitUrl = req.url.split('/');
      if (splitUrl.length === 4) {
        const currentItem = splitUrl[2];
        const action = splitUrl[3];
        try {
          switch (action) {
            case 'take':
              player.takeItem(currentItem);
              break;
            case 'drop':
              player.dropItem(currentItem)
              break;
            case 'eat':
              if (player.items[player.items.indexOf(currentItem)].isFood) {
                player.eatItem(currentItem)
              }
              break;
            default:
              break
          }
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
          res.end();
        } catch (err) {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
          res.end();
        }
      }
    }
    // Phase 6: Redirect if no matching route handlers
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));