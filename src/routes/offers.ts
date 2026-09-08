import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "cloudflare:workers";
import { Offer } from "../models/Offer.js";
import { Product } from "../models/Product.js";

const router = Router();

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

// GET /api/offers — listar ofertas activas
router.get("/", async (req, res) => {
  const filter: any = { activa: true };
  if (req.query.all === "true") delete filter.activa;

  const offers = await Offer.find(filter).populate("productoId");
  res.json(offers);
});

// GET /api/offers/:id
router.get("/:id", async (req, res) => {
  const offer = await Offer.findById(req.params.id).populate("productoId");
  if (!offer) return res.status(404).json({ error: "Oferta no encontrada" });
  res.json(offer);
});

// POST /api/offers — crear oferta (protegido)
router.post("/", authMiddleware, async (req, res) => {
  const { productoId, descuento, fechaInicio, fechaFin } = req.body;
  if (!productoId || descuento === undefined) {
    return res.status(400).json({ error: "productoId y descuento son requeridos" });
  }

  // Verificar que el producto existe
  const product = await Product.findById(productoId);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });

  const offer = await Offer.create({
    productoId, descuento, fechaInicio, fechaFin, activa: true,
  });
  res.status(201).json(offer);
});

// PUT /api/offers/:id — actualizar (protegido)
router.put("/:id", authMiddleware, async (req, res) => {
  const updates = { ...req.body };
  delete updates._id;

  const offer = await Offer.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!offer) return res.status(404).json({ error: "Oferta no encontrada" });
  res.json(offer);
});

// DELETE /api/offers/:id — eliminar (protegido)
router.delete("/:id", authMiddleware, async (req, res) => {
  const result = await Offer.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ error: "Oferta no encontrada" });
  res.json({ message: "Oferta eliminada" });
});

export default router;
