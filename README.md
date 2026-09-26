# YT Watch Party

A real-time YouTube watch room built with React, Vite, Express, Socket.IO, MongoDB, and the official YouTube IFrame Player API.

## Features

- Create rooms with a hashed host password and shareable room code
- Join by code or `/room/:roomId` link
- Host, Moderator, and Participant roles
- Backend-enforced playback permissions
- Play, pause, seek, and video-change synchronization over Socket.IO
- Join-in-progress synchronization
- Host promotion/demotion and participant removal
- Responsive red and white interface
- MongoDB persistence with an in-memory fallback for local demos

## Stack and structure

- `client/`: React + Vite UI and YouTube player integration
- `server/`: Express HTTP API, Socket.IO events, Mongoose model, and room service
- `ARCHITECTURE.md`: request and synchronization flow

## Local setup

Prerequisites: Node.js 20+, npm, and MongoDB (local or Atlas).

```bash
npm install
npm install --prefix server
npm install --prefix client
copy server/.env.example server/.env
copy client/.env.example client/.env
npm run dev
```

Always run `npm run dev` from the repository root and leave that terminal running. It starts both the frontend and backend together; running only the client cannot create rooms. Open the Vite URL printed in the terminal (normally `http://localhost:5173`; if that port is busy, Vite selects the next available port). Vite proxies Socket.IO and API traffic to the backend on port 5000, so local CORS settings or a client `.env` URL are not needed.

On macOS/Linux, use `cp` instead of `copy`.

`MONGODB_URI` may be omitted for a local in-memory demo. MongoDB is required for persisted rooms across server restarts.

## Environment variables

Server `.env`: `PORT`, `MONGODB_URI`, and optionally `CLIENT_URL` when hosting the frontend on a separate origin.
Client `.env`: `VITE_SERVER_URL` only when the backend is hosted at a separate public origin. Leave it unset for local development and same-origin deployments. A `localhost` server URL is intentionally ignored by deployed clients.
Never commit `.env` files or credentials.

## Production deployment

Render is a suitable deployment target because it supports a persistent Node process and WebSockets.

1. Create a MongoDB Atlas database and allow the deployment service IP.
2. Create a Render Web Service from this repository.
3. Set build command to `npm install && npm install --prefix server && npm install --prefix client && npm run build --prefix client`.
4. Set start command to `npm start`.
5. Set `MONGODB_URI` if persistent room storage is needed. Do not set `VITE_SERVER_URL` for this single-service deployment; the app serves the frontend and Socket.IO from the same public origin. Render supplies the public origin automatically for CORS.
6. Deploy the service and share its public HTTPS URL. A local `localhost` URL only works on the computer running the app; other people need the deployed URL.

Live URL: deploy this service to get a shareable public URL.

## WebSocket events

| Event | Direction | Permission |
| --- | --- | --- |
| `create_room`, `join_room` | client -> server | public entry |
| `play`, `pause`, `seek`, `change_video` | client -> server | Host |
| `assign_role`, `remove_participant` | client -> server | Host |
| `room_state`, `sync_state`, `playback_updated`, `video_changed` | server -> clients | room members |
| `participants_updated`, `user_joined`, `user_left`, `role_assigned` | server -> clients | room members |

## Security and limitations

Roles are looked up from server-side room state; client role labels are never trusted. Host passwords are bcrypt hashes and are never sent to clients. YouTube embeds can still be affected by browser autoplay policy and video owner restrictions. The in-memory fallback is intended for development only. A multi-instance deployment would need a Socket.IO adapter such as Redis for cross-process broadcasts.

## Interview walkthrough

The browser creates a YouTube `YT.Player`. Authorized local player events are sent to Socket.IO. The server validates the socket's participant role, updates the authoritative room state, persists it, and broadcasts a small playback event to other sockets. Remote clients apply that event under a synchronization guard so player callbacks do not create an infinite broadcast loop.
