# Private Table server starter

This is a **starter backend** for your Blackjack app's Private Table feature.

It gives you:
- create room
- join room by code
- ready state
- room lobby sync
- host-only start button
- in-memory room storage for local development

It does **not** yet sync the actual card game.

## Folder placement

Put the `server` folder anywhere convenient, for example:

```text
blackjack game/
├── server/
│   ├── package.json
│   └── server.js
├── js/
│   └── private-table.js
└── private-table.html
```

The sample client file can be used as reference for wiring your existing `private-table.js`.

## Install and run

From inside the `server` folder:

```bash
npm install
npm run dev
```

The server runs on:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## Socket events

### Client -> server
- `room:create`
- `room:join`
- `room:set-ready`
- `room:start`
- `room:leave`

### Server -> client
- `server:hello`
- `room:state`
- `room:started`

## Notes

This starter uses **Socket.IO rooms**, which are server-side channels sockets can join and leave, making them a natural fit for private game rooms. citeturn153302search0turn153302search3

Socket.IO itself is a real-time, bidirectional, event-based library for browser/server communication. citeturn153302search1

For later scaling across multiple server instances, Socket.IO documents using a different adapter such as the Redis adapter. citeturn153302search6turn153302search13
