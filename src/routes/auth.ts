import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "cloudflare:workers";
import { User } from "../models/User.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email y password son requeridos" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  // NOTE: En producción usa bcrypt. Aquí comparación simple.
  if (user.password !== password) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRE || "7d" }
  );

  res.json({
    token,
    user: { id: user._id, email: user.email, name: user.name, role: user.role },
  });
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password y name son requeridos" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Ya existe un usuario con ese email" });
  }

  // NOTE: En producción hashea el password con bcrypt antes de guardar
  const user = await User.create({ email, password, name, role: "user" });

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRE || "7d" }
  );

  res.status(201).json({
    token,
    user: { id: user._id, email: user.email, name: user.name, role: user.role },
  });
});

// GET /api/auth/me — verificar token
router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  const token = header.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
});

export default router;
