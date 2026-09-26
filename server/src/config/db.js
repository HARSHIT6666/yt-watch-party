import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  if (!uri) {
    console.warn('MONGODB_URI is not set; running with in-memory room state.');
    return false;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return false;
  }
}
