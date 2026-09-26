import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import Room from '../models/Room.js';

const memoryRooms = new Map();
const useDatabase = () => Boolean(Room.db?.readyState === 1);

export function publicState(room) {
  return {
    roomId: room.roomId,
    videoId: room.videoId,
    playbackState: room.playbackState,
    currentTime: room.currentTime,
    lastUpdatedAt: room.lastUpdatedAt,
    participants: room.participants.map(({ userId, username, role }) => ({ userId, username, role }))
  };
}

export async function createRoom({ username, password, videoId }) {
  const room = { roomId: nanoid(7).toUpperCase(), hostUserId: nanoid(12), hostPasswordHash: await bcrypt.hash(password, 10), videoId, playbackState: 'PAUSED', currentTime: 0, lastUpdatedAt: new Date(), participants: [] };
  if (useDatabase()) return Room.create(room);
  memoryRooms.set(room.roomId, room);
  return room;
}

export async function findRoom(roomId) {
  if (useDatabase()) return Room.findOne({ roomId }).select('+hostPasswordHash');
  return memoryRooms.get(roomId);
}

export async function saveRoom(room) {
  room.lastUpdatedAt = new Date();
  if (useDatabase()) return room.save();
  memoryRooms.set(room.roomId, room);
  return room;
}
