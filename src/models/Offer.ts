import { mongoose } from "../db.js";

const offerSchema = new mongoose.Schema({
  productoId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  descuento: { type: Number, required: true, min: 0, max: 100 },
  fechaInicio: { type: String },
  fechaFin: { type: String },
  activa: { type: Boolean, default: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
