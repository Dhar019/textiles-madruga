import { mongoose } from "../db.js";

const productSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, default: "" },
  precio: { type: Number, required: true },
  categoria: { type: String, default: "general" },
  imagen: { type: String, default: "" },
  activo: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

export const Product = mongoose.model("Product", productSchema);
export default Product;
