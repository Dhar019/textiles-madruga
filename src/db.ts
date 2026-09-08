import mongoose from "mongoose";
import { env } from "cloudflare:workers";

let isConnected = false;

/**
 * Conexión a MongoDB Atlas usando mongoose.
 * Adaptada para Cloudflare Workers con nodejs_compat.
 *
 * Limitaciones de Workers:
 * - Máximo 6 conexiones TCP simultáneas por aislado
 * - Usamos maxPoolSize: 1 para respetar este límite
 * - bufferCommands: false para no acumular operaciones en memoria
 * - serverSelectionTimeoutMS: 5000 para fallar rápido
 */
export async function connectDB(): Promise<void> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const uri = env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI no configurado. Ejecuta: npx wrangler secret put MONGODB_URI");
  }

  await mongoose.connect(uri, {
    maxPoolSize: 1,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
    bufferTimeoutMS: 5000,
  });

  isConnected = true;
  console.log("MongoDB conectado correctamente");
}

export { mongoose };
