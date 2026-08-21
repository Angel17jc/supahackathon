/**
 * Puebla la base con el marketplace de la demo: cuatro tiendas de barrio, su
 * catálogo publicado con portada en Storage, dos compradores y apartados
 * cruzados.
 *
 * Los apartados cruzados no son decorado. Sin ellos, "la tienda B no ve los
 * apartados de la tienda A" se demuestra sobre una tabla vacía, que es lo mismo
 * que no demostrar nada: el jurado ve cero filas y no puede distinguir si RLS
 * está filtrando o si simplemente no hay datos.
 *
 * Uso: npm run db:seed
 *
 * Es idempotente: vuelve a dejar el mismo estado cada vez que se ejecuta.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabase-url.js";

const BUCKET = "productos";
const PASSWORD = "Secreta123";

interface ProductSeed {
  name: string;
  description: string;
  sku: string;
  category: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  minStock: number;
}

interface ShopSeed {
  slug: string;
  name: string;
  accent: string;
  ownerEmail: string;
  ownerName: string;
  categories: string[];
  products: ProductSeed[];
}

const shops: ShopSeed[] = [
  {
    slug: "licoreria-el-faro",
    name: "Licorería El Faro",
    accent: "#c2410c",
    ownerEmail: "faro@demo.com",
    ownerName: "Marta Rueda",
    categories: ["Cervezas", "Destilados", "Vinos"],
    products: [
      { name: "Cerveza Pilsen 330 ml", description: "Six pack de cerveza rubia local", sku: "FAR-CER-001", category: "Cervezas", quantity: 48, costPrice: 4.2, sellingPrice: 7.5, minStock: 12 },
      { name: "Cerveza Artesanal IPA", description: "Botella 500 ml, lúpulo cítrico", sku: "FAR-CER-002", category: "Cervezas", quantity: 24, costPrice: 2.8, sellingPrice: 5.9, minStock: 6 },
      { name: "Ron Añejo 5 años", description: "Botella 750 ml, añejado en roble", sku: "FAR-DES-001", category: "Destilados", quantity: 15, costPrice: 11.0, sellingPrice: 19.9, minStock: 4 },
      { name: "Whisky Escocés 12 años", description: "Single malt, botella 700 ml", sku: "FAR-DES-002", category: "Destilados", quantity: 8, costPrice: 28.0, sellingPrice: 49.9, minStock: 3 },
      { name: "Aguardiente de Caña", description: "Botella 500 ml, receta tradicional", sku: "FAR-DES-003", category: "Destilados", quantity: 30, costPrice: 3.5, sellingPrice: 6.9, minStock: 10 },
      { name: "Vino Tinto Reserva", description: "Cosecha 2019, cuerpo medio", sku: "FAR-VIN-001", category: "Vinos", quantity: 18, costPrice: 7.5, sellingPrice: 14.5, minStock: 5 },
      { name: "Vino Blanco Semiseco", description: "Ideal para pescados, 750 ml", sku: "FAR-VIN-002", category: "Vinos", quantity: 20, costPrice: 6.0, sellingPrice: 11.9, minStock: 5 },
      { name: "Espumante Brut", description: "Botella 750 ml para celebraciones", sku: "FAR-VIN-003", category: "Vinos", quantity: 12, costPrice: 9.0, sellingPrice: 17.5, minStock: 4 },
      { name: "Hielo en Bolsa 2 kg", description: "Hielo en cubos, bolsa sellada", sku: "FAR-CER-003", category: "Cervezas", quantity: 60, costPrice: 0.6, sellingPrice: 1.5, minStock: 20 },
      { name: "Copas de Vidrio (6 uds)", description: "Juego de seis copas de cristal", sku: "FAR-VIN-004", category: "Vinos", quantity: 10, costPrice: 5.5, sellingPrice: 12.0, minStock: 3 },
    ],
  },
  {
    slug: "panaderia-la-espiga",
    name: "Panadería La Espiga",
    accent: "#b45309",
    ownerEmail: "espiga@demo.com",
    ownerName: "Julián Ortiz",
    categories: ["Panes", "Pastelería", "Desayuno"],
    products: [
      { name: "Pan de Masa Madre", description: "Hogaza de 800 g, fermentación de 24 h", sku: "ESP-PAN-001", category: "Panes", quantity: 25, costPrice: 1.8, sellingPrice: 4.2, minStock: 8 },
      { name: "Baguette Tradicional", description: "Barra crujiente horneada cada mañana", sku: "ESP-PAN-002", category: "Panes", quantity: 40, costPrice: 0.7, sellingPrice: 1.8, minStock: 15 },
      { name: "Pan Integral de Centeno", description: "Molde de 500 g con semillas", sku: "ESP-PAN-003", category: "Panes", quantity: 18, costPrice: 1.4, sellingPrice: 3.5, minStock: 6 },
      { name: "Croissant de Mantequilla", description: "Hojaldre artesanal, unidad", sku: "ESP-DES-001", category: "Desayuno", quantity: 50, costPrice: 0.6, sellingPrice: 1.6, minStock: 20 },
      { name: "Empanada de Queso", description: "Horneada, unidad", sku: "ESP-DES-002", category: "Desayuno", quantity: 35, costPrice: 0.8, sellingPrice: 2.0, minStock: 12 },
      { name: "Torta de Chocolate", description: "Porción individual con ganache", sku: "ESP-PAS-001", category: "Pastelería", quantity: 20, costPrice: 1.5, sellingPrice: 3.8, minStock: 6 },
      { name: "Cheesecake de Maracuyá", description: "Porción con salsa de maracuyá", sku: "ESP-PAS-002", category: "Pastelería", quantity: 16, costPrice: 1.9, sellingPrice: 4.5, minStock: 5 },
      { name: "Alfajores de Maicena (6 uds)", description: "Caja de seis unidades", sku: "ESP-PAS-003", category: "Pastelería", quantity: 22, costPrice: 2.2, sellingPrice: 5.5, minStock: 8 },
      { name: "Café Molido 250 g", description: "Tueste medio de altura", sku: "ESP-DES-003", category: "Desayuno", quantity: 30, costPrice: 3.0, sellingPrice: 6.5, minStock: 10 },
      { name: "Mermelada de Mora 300 g", description: "Elaboración propia sin conservantes", sku: "ESP-DES-004", category: "Desayuno", quantity: 24, costPrice: 1.6, sellingPrice: 3.9, minStock: 8 },
    ],
  },
  {
    slug: "ferreteria-don-luis",
    name: "Ferretería Don Luis",
    accent: "#1d4ed8",
    ownerEmail: "donluis@demo.com",
    ownerName: "Luis Pazmiño",
    categories: ["Herramientas", "Electricidad", "Pintura"],
    products: [
      { name: "Taladro Percutor 650 W", description: "Con maletín y juego de brocas", sku: "DLU-HER-001", category: "Herramientas", quantity: 9, costPrice: 42.0, sellingPrice: 79.9, minStock: 3 },
      { name: "Juego de Llaves 12 pz", description: "Acero cromo vanadio", sku: "DLU-HER-002", category: "Herramientas", quantity: 14, costPrice: 12.5, sellingPrice: 24.9, minStock: 5 },
      { name: "Martillo de Uña 16 oz", description: "Mango de fibra antideslizante", sku: "DLU-HER-003", category: "Herramientas", quantity: 20, costPrice: 5.0, sellingPrice: 10.9, minStock: 6 },
      { name: "Cinta Métrica 5 m", description: "Carcasa reforzada con freno", sku: "DLU-HER-004", category: "Herramientas", quantity: 32, costPrice: 2.4, sellingPrice: 5.5, minStock: 10 },
      { name: "Foco LED 12 W", description: "Luz cálida, rosca E27", sku: "DLU-ELE-001", category: "Electricidad", quantity: 60, costPrice: 1.2, sellingPrice: 3.2, minStock: 20 },
      { name: "Cable Gemelo 2x14 (m)", description: "Precio por metro, cobre puro", sku: "DLU-ELE-002", category: "Electricidad", quantity: 200, costPrice: 0.5, sellingPrice: 1.3, minStock: 50 },
      { name: "Tomacorriente Doble", description: "Con placa y tornillos", sku: "DLU-ELE-003", category: "Electricidad", quantity: 45, costPrice: 1.1, sellingPrice: 2.8, minStock: 15 },
      { name: "Pintura Látex Blanco 1 gl", description: "Interior, rendimiento 40 m²", sku: "DLU-PIN-001", category: "Pintura", quantity: 16, costPrice: 9.5, sellingPrice: 18.9, minStock: 5 },
      { name: "Brocha 3 pulgadas", description: "Cerda natural con mango de madera", sku: "DLU-PIN-002", category: "Pintura", quantity: 28, costPrice: 1.3, sellingPrice: 3.4, minStock: 10 },
      { name: "Lija de Agua (10 uds)", description: "Grano 220, paquete de diez", sku: "DLU-PIN-003", category: "Pintura", quantity: 40, costPrice: 1.0, sellingPrice: 2.6, minStock: 12 },
    ],
  },
  {
    slug: "verduleria-sol",
    name: "Verdulería Sol",
    accent: "#15803d",
    ownerEmail: "sol@demo.com",
    ownerName: "Rosa Chávez",
    categories: ["Frutas", "Verduras", "Granos"],
    products: [
      { name: "Banano Orgánico (kg)", description: "Cosecha de la semana", sku: "SOL-FRU-001", category: "Frutas", quantity: 80, costPrice: 0.5, sellingPrice: 1.2, minStock: 25 },
      { name: "Manzana Roja (kg)", description: "Importada, calibre grande", sku: "SOL-FRU-002", category: "Frutas", quantity: 45, costPrice: 1.4, sellingPrice: 2.9, minStock: 15 },
      { name: "Naranja de Jugo (kg)", description: "Ideal para zumo, muy dulce", sku: "SOL-FRU-003", category: "Frutas", quantity: 60, costPrice: 0.6, sellingPrice: 1.4, minStock: 20 },
      { name: "Aguacate Hass (unidad)", description: "Punto justo de maduración", sku: "SOL-FRU-004", category: "Frutas", quantity: 50, costPrice: 0.7, sellingPrice: 1.8, minStock: 15 },
      { name: "Tomate Riñón (kg)", description: "De invernadero, firme", sku: "SOL-VER-001", category: "Verduras", quantity: 55, costPrice: 0.8, sellingPrice: 1.9, minStock: 18 },
      { name: "Cebolla Paiteña (kg)", description: "Morada, de la sierra", sku: "SOL-VER-002", category: "Verduras", quantity: 70, costPrice: 0.6, sellingPrice: 1.5, minStock: 20 },
      { name: "Zanahoria (kg)", description: "Lavada y lista para usar", sku: "SOL-VER-003", category: "Verduras", quantity: 48, costPrice: 0.5, sellingPrice: 1.3, minStock: 15 },
      { name: "Lechuga Crespa (unidad)", description: "Fresca, cosechada hoy", sku: "SOL-VER-004", category: "Verduras", quantity: 36, costPrice: 0.4, sellingPrice: 1.1, minStock: 12 },
      { name: "Arroz Flor 2 kg", description: "Grano largo seleccionado", sku: "SOL-GRA-001", category: "Granos", quantity: 40, costPrice: 1.9, sellingPrice: 3.6, minStock: 12 },
      { name: "Lenteja Nacional 500 g", description: "Libre de impurezas", sku: "SOL-GRA-002", category: "Granos", quantity: 38, costPrice: 0.9, sellingPrice: 2.1, minStock: 12 },
    ],
  },
];

const buyers = [
  { email: "ana@demo.com", name: "Ana Villacís" },
  { email: "diego@demo.com", name: "Diego Salazar" },
];

const url = normalizeSupabaseUrl(process.env.SUPABASE_URL ?? "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar en .env");
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Portada generada en el momento: sin ella no hay nada que subir a Storage y el
 *  bucket queda de adorno, que es justo lo que el reto pide evitar. */
function coverSvg(title: string, shop: string, accent: string): string {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 18) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  if (current.trim()) lines.push(current.trim());

  const text = lines
    .slice(0, 3)
    .map((line, index) => `<tspan x="60" dy="${index === 0 ? 0 : 54}">${escape(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="#0f172a"/>
  </linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="660" cy="120" r="150" fill="#ffffff" opacity="0.06"/>
  <circle cx="120" cy="520" r="110" fill="#ffffff" opacity="0.05"/>
  <text x="60" y="230" font-family="Georgia, serif" font-size="46" fill="#ffffff">${text}</text>
  <text x="60" y="540" font-family="Georgia, serif" font-size="24" fill="#ffffff" opacity="0.75">${escape(shop)}</text>
</svg>`;
}

async function findUserByEmail(email: string) {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
}

async function ensureUser(email: string, appMetadata: Record<string, unknown>): Promise<string> {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password: PASSWORD, app_metadata: appMetadata });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureOrganization(slug: string, name: string): Promise<string> {
  const found = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) {
    const { error } = await db.from("organizations").update({ name, status: "active" }).eq("id", found.data.id);
    if (error) throw error;
    return found.data.id;
  }
  const inserted = await db.from("organizations").insert({ name, slug }).select("id").single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function main() {
  console.log("Vaciando el catálogo anterior…");
  // El orden importa: los apartados y los movimientos apuntan a productos, y la
  // clave foránea es RESTRICT, no CASCADE.
  for (const table of ["reservations", "movements", "products", "categories"]) {
    const { error } = await db.from(table).delete().neq("id", table === "reservations" ? "00000000-0000-0000-0000-000000000000" : 0);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  const shopIds: Record<string, string> = {};
  const productIndex: { id: number; organizationId: string; name: string; shop: string }[] = [];

  for (const shop of shops) {
    console.log(`\n${shop.name}`);
    const organizationId = await ensureOrganization(shop.slug, shop.name);
    shopIds[shop.slug] = organizationId;

    const ownerId = await ensureUser(shop.ownerEmail, {});
    const membership = await db
      .from("organization_memberships")
      .upsert({ organization_id: organizationId, user_id: ownerId, role: "owner", status: "active" }, { onConflict: "organization_id,user_id" });
    if (membership.error) throw membership.error;
    await db.from("profiles").upsert({ id: ownerId, full_name: shop.ownerName });
    console.log(`  dueño: ${shop.ownerEmail}`);

    const categoryRows = shop.categories.map((name) => ({ name, organization_id: organizationId }));
    const categories = await db.from("categories").insert(categoryRows).select("id, name");
    if (categories.error) throw categories.error;
    const categoryId = new Map(categories.data.map((row: any) => [row.name, row.id]));

    const productRows = shop.products.map((product) => ({
      organization_id: organizationId,
      name: product.name,
      description: product.description,
      sku: product.sku,
      quantity: product.quantity,
      cost_price: product.costPrice,
      selling_price: product.sellingPrice,
      min_stock_level: product.minStock,
      category_id: categoryId.get(product.category),
      is_published: true,
    }));
    const products = await db.from("products").insert(productRows).select("id, name");
    if (products.error) throw products.error;
    console.log(`  ${products.data.length} productos publicados`);

    for (const row of products.data as any[]) {
      const path = `${organizationId}/${row.id}/portada.svg`;
      const upload = await db.storage
        .from(BUCKET)
        .upload(path, coverSvg(row.name, shop.name, shop.accent), { contentType: "image/svg+xml", upsert: true });
      if (upload.error) throw new Error(`portada de ${row.name}: ${upload.error.message}`);
      const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
      const updated = await db.from("products").update({ image_url: publicUrl }).eq("id", row.id);
      if (updated.error) throw updated.error;
      productIndex.push({ id: row.id, organizationId, name: row.name, shop: shop.slug });
    }
    console.log(`  ${products.data.length} portadas en Storage`);
  }

  console.log("\nCompradores");
  const buyerIds: string[] = [];
  for (const buyer of buyers) {
    const id = await ensureUser(buyer.email, {});
    await db.from("profiles").upsert({ id, full_name: buyer.name });
    buyerIds.push(id);
    console.log(`  ${buyer.email}`);
  }

  // Apartados repartidos entre tiendas distintas: cada vendedor debe ver solo
  // los suyos y cada comprador solo los propios, y eso no se puede enseñar si
  // todos los apartados viven en la misma tienda.
  const pick = (shop: string, offset: number) => productIndex.filter((p) => p.shop === shop)[offset];
  const reservationPlan = [
    { buyer: 0, product: pick("licoreria-el-faro", 2), quantity: 1, note: "¿Lo tienen frío para hoy?" },
    { buyer: 0, product: pick("panaderia-la-espiga", 0), quantity: 2, note: "Paso a recogerlo a las 8" },
    { buyer: 0, product: pick("verduleria-sol", 4), quantity: 3, note: "Para el almuerzo del domingo" },
    { buyer: 1, product: pick("ferreteria-don-luis", 0), quantity: 1, note: "¿Incluye las brocas?" },
    { buyer: 1, product: pick("licoreria-el-faro", 5), quantity: 2, note: "Para un regalo" },
    { buyer: 1, product: pick("panaderia-la-espiga", 6), quantity: 1, note: "¿Sin azúcar añadida?" },
  ];

  const reservationRows = reservationPlan
    .filter((entry) => entry.product)
    .map((entry) => ({
      product_id: entry.product.id,
      organization_id: entry.product.organizationId,
      buyer_id: buyerIds[entry.buyer],
      quantity: entry.quantity,
      note: entry.note,
      status: "pending",
    }));
  const reservations = await db.from("reservations").insert(reservationRows);
  if (reservations.error) throw reservations.error;
  console.log(`\n${reservationRows.length} apartados repartidos entre tiendas`);

  console.log("\nListo. Todas las cuentas usan la contraseña " + PASSWORD);
}

main().catch((error) => {
  console.error("\nFalló el seed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
