// Script generado automáticamente desde productos.json
const db = db.getSiblingDB("textiles");

// ============================================
// USUARIOS
// ============================================
db.users.deleteMany({})
db.users.insertMany([
  { username: "Texmadmin", password: "TexMadmin2026*/", role: "superadmin", name: "Texmadmin", createdAt: new Date() },
  { username: "admin1", password: "admin123", role: "admin", name: "Administrador 1", createdAt: new Date() },
  { username: "usuario1", password: "user123", role: "user", name: "Usuario Normal", createdAt: new Date() }
])

// ============================================
// PRODUCTOS
// ============================================
db.products.deleteMany({})
db.products.insertMany([
  { id: 4, nombre: "Camisa Azul", precio: 25, categoria: "hombre", imagen: "assets/img/ropa/hombre/camisas/camisa-azul.jpg", unidad: "", enOferta: true, descuento: 15 },
  { id: 5, nombre: "Camisa Blanca", precio: 35, categoria: "hombre", imagen: "assets/img/ropa/hombre/camisas/camisa-blanca.jpg", unidad: "", enOferta: false, descuento: 0 },
  { id: 6, nombre: "Camisa Mamey", precio: 60, categoria: "hombre", imagen: "assets/img/ropa/hombre/camisas/camisa-mamey.jpg", unidad: "", enOferta: false, descuento: 0 },
  { id: 7, nombre: "Camisa Blanca Manga Corta", precio: 60, categoria: "hombre", imagen: "assets/img/ropa/hombre/camisas/camisa-mangas-cortas-blanca.jpg", unidad: "", enOferta: false, descuento: 0 },
  { id: 8, nombre: "Camisa Verde Manga Corta", precio: 60, categoria: "hombre", imagen: "assets/img/ropa/hombre/camisas/camisa-mangas-cortas-verde.jpg", unidad: "", enOferta: false, descuento: 0 },
  { id: 9, nombre: "Vestido Negro con Flores Blancas", precio: 45, categoria: "mujer", imagen: "assets/img/ropa/mujer/vestidos/vestido-negro-flores-blancas.jpg", unidad: "", enOferta: true, descuento: 15 },
  { id: 10, nombre: "Vestido Verano Floreado", precio: 38, categoria: "mujer", imagen: "assets/img/ropa/mujer/ropa-mujer-vestido-verano-floreado.jpg", unidad: "", enOferta: false, descuento: 0 },
  { id: 11, nombre: "Blusa Lino", precio: 28, categoria: "mujer", imagen: "assets/img/ropa/mujer/ropa-mujer-blusa-lino.jpg", unidad: "", enOferta: false, descuento: 0 },
  { id: 12, nombre: "Lino Natural", precio: 12, categoria: "telas", imagen: "https://placehold.co/280x250/F5E6D3/1A1A1A?text=Lino", unidad: "/m", enOferta: true, descuento: 15 },
  { id: 13, nombre: "Algodón Premium", precio: 8, categoria: "telas", imagen: "https://placehold.co/280x250/F5E6D3/1A1A1A?text=Algod%C3%B3n", unidad: "/m", enOferta: false, descuento: 0 },
  { id: 14, nombre: "Seda Natural", precio: 25, categoria: "telas", imagen: "https://placehold.co/280x250/F5E6D3/1A1A1A?text=Seda", unidad: "/m", enOferta: false, descuento: 0 },
  { id: 15, nombre: "Pozuelo Cerámica", precio: 15, categoria: "objetos", imagen: "https://placehold.co/280x250/D4A574/1A1A1A?text=Pozuelo", unidad: "", enOferta: false, descuento: 0 },
  { id: 16, nombre: "Mochila Artesanal", precio: 40, categoria: "objetos", imagen: "https://placehold.co/280x250/D4A574/1A1A1A?text=Mochila", unidad: "", enOferta: false, descuento: 0 },
  { id: 17, nombre: "Taza Personalizada", precio: 10, categoria: "objetos", imagen: "https://placehold.co/280x250/D4A574/1A1A1A?text=Taza", unidad: "", enOferta: false, descuento: 0 }
])

// ============================================
// OFERTAS
// ============================================
db.offers.deleteMany({})
db.offers.insertMany([
  { productoId: 4, descuento: 15, activa: true, createdAt: new Date() },
  { productoId: 9, descuento: 15, activa: true, createdAt: new Date() },
  { productoId: 12, descuento: 15, activa: true, createdAt: new Date() }
])

// ============================================
// VERIFICACIÓN
// ============================================
print("✅ Usuarios creados:", db.users.countDocuments())
print("✅ Productos creados:", db.products.countDocuments())
print("✅ Ofertas creadas:", db.offers.countDocuments())
