import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userId: {
     type: String,
      required: true 
    },
  username: { 
    type: String, 
    required: true
 },
  role: { type: String,
     enum: ['HOST', 'MODERATOR', 'PARTICIPANT'],
      default: 'PARTICIPANT' },
     socketId: String

}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomId: 
  { 
    type: String,
     unique: true,
      required: true, 
      index: true 
    },
  hostUserId: 
  {
    type: String,
     required: true
     },
  hostPasswordHash: 
  { type: String,
     required: true,
      select: false 
    },
  videoId:
   { type: String,
     default: 'dQw4w9WgXcQ' 
    },
  playbackState:
   { type: String, 
    enum: ['PLAYING', 'PAUSED'],
     default: 'PAUSED' 
    },
  currentTime:
   { type: Number,
     default: 0 
    },
  lastUpdatedAt: 
  { type: Date, 
    default: Date.now
 },
  participants:
   { type: [participantSchema],
     default: [] 
    }
}, { timestamps: true });

export default mongoose.model('Room', roomSchema);
