import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "cloudflare:workers";
import { Product } from "../models/Product.js";

const router = Router();

// Middleware de auth para rutas protegidas
function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// GET /api/productos — listar (con filtros opcionales)
router.get("/", async (req, res) => {
  const filter: any = {};
  if (req.query.categoria) filter.categoria = req.query.categoria;
  if (req.query.activo !== undefined) filter.activo = req.query.activo === "true";

  const productos = await Product.find(filter).sort({ createdAt: -1 });
  res.json(productos);
});

// GET /api/productos/:id
router.get("/:id", async (req, res) => {
  const producto = await Product.findById(req.params.id);
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(producto);
});

// POST /api/productos — crear (protegido)
router.post("/", authMiddleware, async (req, res) => {
  const { nombre, descripcion, precio, categoria, imagen, stock } = req.body;
  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: "Nombre y precio son requeridos" });
  }
  const producto = await Product.create({
    nombre, descripcion, precio, categoria, imagen, stock,
    activo: true,
  });
  res.status(201).json(producto);
});

// PUT /api/productos/:id — actualizar (protegido)
router.put("/:id", authMiddleware, async (req, res) => {
  const updates = { ...req.body };
  delete updates._id;
  updates.updatedAt = new Date().toISOString();

  const producto = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(producto);
});

// DELETE /api/productos/:id — eliminar (protegido)
router.delete("/:id", authMiddleware, async (req, res) => {
  const result = await Product.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ error: "Producto no encontrado" });
  res.json({ message: "Producto eliminado" });
});

export default router;
