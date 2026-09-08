import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import express from "express";
import jwt from "jsonwebtoken";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import productosRoutes from "./routes/productos.js";
import offersRoutes from "./routes/offers.js";
import usersRoutes from "./routes/users.js";

const app = express();
app.use(express.json());

// --- Connect to MongoDB on first request (lazy init) ---
let dbConnected = false;

app.use(async (req, res, next) => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
    } catch (err) {
      console.error("MongoDB connection failed:", err);
      return res.status(503).json({ error: "Database connection failed" });
    }
  }
  next();
});

// --- JWT Auth Middleware ---
function authMiddleware(required: boolean = true) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      if (!required) return next();
      return res.status(401).json({ error: "Token no proporcionado" });
    }
    const token = header.split(" ")[1];
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
  };
}

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/users", authMiddleware(true), usersRoutes);

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: dbConnected ? "connected" : "disconnected", timestamp: new Date().toISOString() });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// --- Error handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(3000);
export default httpServerHandler({ port: 3000 });
