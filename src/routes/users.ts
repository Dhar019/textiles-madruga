import { Router } from "express";
import { User } from "../models/User.js";

const router = Router();

// GET /api/users — listar todos los usuarios
router.get("/", async (req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
  res.json(users);
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id, { password: 0 });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(user);
});

// PUT /api/users/:id — actualizar
router.put("/:id", async (req, res) => {
  const updates = { ...req.body };
  delete updates._id;
  delete updates.password; // No actualizar password aquí

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(user);
});

// DELETE /api/users/:id — eliminar
router.delete("/:id", async (req, res) => {
  const result = await User.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ message: "Usuario eliminado" });
});

export default router;
