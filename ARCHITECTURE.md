# Architecture

```text
Browser
  -> React UI and YouTube IFrame Player API
  -> Socket.IO client
  -> Express + Socket.IO server
  -> authoritative room state
  -> MongoDB via Mongoose
```

## Room creation

The client sends a username, host password, and optional YouTube URL. The server validates the payload, extracts only the 11-character YouTube video ID, hashes the password with bcrypt, creates a unique room code, and adds the creator as the only `HOST` participant.

## Joining

A socket sends `join_room`. The server finds the room, creates a random user ID, assigns `PARTICIPANT`, adds the socket to the Socket.IO room, and sends the full public state to the new socket. Existing members receive participant updates.

## Synchronization

Host and Moderator player actions are sent as `play`, `pause`, `seek`, or `change_video`. The server checks the actor from its own participant list before updating `playbackState`, `currentTime`, or `videoId`. It broadcasts the accepted action to all other sockets. The YouTube player applies remote actions through a guard so remote state changes do not emit a second outbound action.

## Permissions

`HOST` and `MODERATOR` can control playback. Only `HOST` can assign roles or remove participants. Every protected event performs this check on the server; disabled buttons in React are only a usability layer.

## Join-in-progress

The room stores the last known position and timestamp. New members receive the state immediately and the client seeks the player to that position. For a simple internship-sized system, the saved position is intentionally conservative; a future improvement can calculate elapsed playing time from `lastUpdatedAt`.

## Disconnects

The server removes the socket's participant record on `leave_room` and `disconnect`, then broadcasts the updated list. Host transfer is deliberately omitted from this MVP; if the host disconnects, the room remains persisted and the next product iteration can implement an atomic transfer policy.
