import { nanoid } from 'nanoid';
import { extractVideoId } from '../utils/youtube.js';
import { canControl, isHost } from '../utils/permissions.js';
import { createRoom, findRoom, publicState, saveRoom } from '../services/roomService.js';

const cleanName = value => typeof value === 'string' ? value.trim().slice(0, 32) : '';
const emitError = (socket, message, type = 'INVALID') => socket.emit('error', { type, message });
const roomParticipant = (room, socket) => room.participants.find(participant => participant.socketId === socket.id);
const broadcastParticipants = (io, room) => io.to(room.roomId).emit('participants_updated', { participants: publicState(room).participants });
const controlGuard = (socket, room) => {
  const participant = roomParticipant(room, socket);
  if (!participant || !canControl(participant.role)) { emitError(socket, 'You do not have permission to control playback.', 'FORBIDDEN'); return null; }
  return participant;
};

export function registerRoomHandlers(io, socket) {
  socket.on('create_room', async (payload = {}) => {
    const username = cleanName(payload.username);
    const password = typeof payload.password === 'string' ? payload.password : '';
    const videoId = payload.videoId ? extractVideoId(payload.videoId) : 'dQw4w9WgXcQ';
    if (!username || password.length < 6 || !videoId) return emitError(socket, 'Enter a username, a password of at least 6 characters, and a valid YouTube URL.');
    try {
      const room = await createRoom({ username, password, videoId });
      const userId = room.hostUserId;
      room.participants.push({ userId, username, role: 'HOST', socketId: socket.id });
      await saveRoom(room);
      socket.join(room.roomId);
      socket.data = { roomId: room.roomId, userId };
      socket.emit('room_created', { roomId: room.roomId, userId, state: publicState(room) });
    } catch { emitError(socket, 'Unable to create the room right now.', 'SERVER_ERROR'); }
  });

  socket.on('join_room', async (payload = {}) => {
    const roomId = typeof payload.roomId === 'string' ? payload.roomId.trim().toUpperCase() : '';
    const username = cleanName(payload.username);
    if (!roomId || !username) return emitError(socket, 'Enter a room code and username.');
    try {
      const room = await findRoom(roomId);
      if (!room) return emitError(socket, 'Room not found.', 'NOT_FOUND');
      if (roomParticipant(room, socket)) return emitError(socket, 'This session is already in the room.');
      const userId = nanoid(12);
      room.participants.push({ userId, username, role: 'PARTICIPANT', socketId: socket.id });
      await saveRoom(room);
      socket.join(room.roomId);
      socket.data = { roomId: room.roomId, userId };
      socket.emit('room_state', { userId, state: publicState(room) });
      socket.to(room.roomId).emit('user_joined', { username, userId, role: 'PARTICIPANT' });
      broadcastParticipants(io, room);
    } catch { emitError(socket, 'Unable to join the room right now.', 'SERVER_ERROR'); }
  });

  socket.on('request_sync', async () => {
    const room = socket.data.roomId && await findRoom(socket.data.roomId);
    if (room) socket.emit('sync_state', publicState(room));
  });

  for (const event of ['play', 'pause']) socket.on(event, async payload => {
    const room = socket.data.roomId && await findRoom(socket.data.roomId);
    if (!room || !controlGuard(socket, room)) return;
    const time = Number(payload?.currentTime);
    if (!Number.isFinite(time) || time < 0) return emitError(socket, 'Playback position is invalid.');
    room.playbackState = event === 'play' ? 'PLAYING' : 'PAUSED'; room.currentTime = time;
    await saveRoom(room);
    socket.to(room.roomId).emit('playback_updated', { action: event, currentTime: time, updatedAt: room.lastUpdatedAt });
  });

  socket.on('seek', async payload => {
    const room = socket.data.roomId && await findRoom(socket.data.roomId);
    if (!room || !controlGuard(socket, room)) return;
    const time = Number(payload?.time);
    if (!Number.isFinite(time) || time < 0) return emitError(socket, 'Seek position is invalid.');
    room.currentTime = time; await saveRoom(room);
    socket.to(room.roomId).emit('playback_updated', { action: 'seek', time, updatedAt: room.lastUpdatedAt });
  });

  socket.on('change_video', async payload => {
    const room = socket.data.roomId && await findRoom(socket.data.roomId);
    if (!room || !controlGuard(socket, room)) return;
    const videoId = extractVideoId(payload?.videoId);
    if (!videoId) return emitError(socket, 'Enter a valid YouTube URL.');
    room.videoId = videoId; room.playbackState = 'PAUSED'; room.currentTime = 0; await saveRoom(room);
    io.to(room.roomId).emit('video_changed', { videoId });
  });

  socket.on('assign_role', async payload => {
    const room = socket.data.roomId && await findRoom(socket.data.roomId);
    const actor = room && roomParticipant(room, socket);
    if (!room || !actor || !isHost(actor.role)) return emitError(socket, 'Only the host can assign roles.', 'FORBIDDEN');
    if (!['MODERATOR', 'PARTICIPANT'].includes(payload?.role)) return emitError(socket, 'That role is invalid.');
    const target = room.participants.find(participant => participant.userId === payload.userId);
    if (!target || target.role === 'HOST') return emitError(socket, 'Participant not found.');
    target.role = payload.role; await saveRoom(room);
    io.to(room.roomId).emit('role_assigned', { userId: target.userId, role: target.role }); broadcastParticipants(io, room);
  });

  socket.on('remove_participant', async payload => {
    const room = socket.data.roomId && await findRoom(socket.data.roomId);
    const actor = room && roomParticipant(room, socket);
    if (!room || !actor || !isHost(actor.role)) return emitError(socket, 'Only the host can remove participants.', 'FORBIDDEN');
    const index = room.participants.findIndex(participant => participant.userId === payload?.userId);
    if (index < 0 || room.participants[index].role === 'HOST') return emitError(socket, 'Participant not found.');
    const [removed] = room.participants.splice(index, 1); await saveRoom(room);
    io.to(removed.socketId).emit('participant_removed', { userId: removed.userId });
    io.sockets.sockets.get(removed.socketId)?.leave(room.roomId);
    io.to(room.roomId).emit('user_left', { userId: removed.userId, username: removed.username }); broadcastParticipants(io, room);
  });

  const leave = async () => {
    const roomId = socket.data.roomId; if (!roomId) return;
    const room = await findRoom(roomId); if (!room) return;
    const index = room.participants.findIndex(participant => participant.socketId === socket.id);
    if (index < 0) return;
    const [left] = room.participants.splice(index, 1); await saveRoom(room);
    socket.leave(roomId); socket.data = {};
    io.to(roomId).emit('user_left', { userId: left.userId, username: left.username }); broadcastParticipants(io, room);
  };
  socket.on('leave_room', leave);
  socket.on('disconnect', leave);
}
