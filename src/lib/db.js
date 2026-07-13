import "server-only";
import mongoose from "mongoose";

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.DATABASE_URL;
}

function isLocalMongoUri(uri) {
  return /^(mongodb(\+srv)?:\/\/)(localhost|127\.0\.0\.1)/i.test(String(uri || ""));
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error(
      "Missing MongoDB connection string. Set MONGODB_URI (or DATABASE_URL) in your environment."
    );
  }

  if (process.env.NODE_ENV === "production" && isLocalMongoUri(mongoUri)) {
    throw new Error(
      "MONGODB_URI points to localhost in production. Set MONGODB_URI to your MongoDB Atlas (mongodb+srv://…) connection string in Vercel → Project → Settings → Environment Variables."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongoUri, {
        bufferCommands: false,
        maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 30),
        minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 5),
        serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000),
      })
      .then((mongooseInstance) => mongooseInstance)
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
