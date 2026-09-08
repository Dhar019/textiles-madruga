import { mongoose } from "../db.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const User = mongoose.model("User", userSchema);
export default User;
