/**
 * Repara las portadas del catálogo que no cargan.
 *
 * Algunos identificadores de Unsplash del seed no existen y devuelven 404, así
 * que el navegador enseña el texto alternativo en lugar de la foto.
 *
 * Cada candidato se comprueba con una petición real antes de guardarlo: escribir
 * un identificador sin verificar solo cambiaría un 404 por otro, y el fallo
 * volvería a aparecer en la demo en vez de aquí.
 *
 * Si ningún candidato responde, genera una portada propia y la sube al bucket.
 * Esa reserva importa: deja el catálogo sin huecos pase lo que pase, y la imagen
 * queda servida desde Supabase Storage, que el CSP ya autoriza.
 *
 * Uso: npx tsx script/fix-broken-covers.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabase-url.js";

const BUCKET = "productos";
const SIZE = "?w=600&h=400&fit=crop";

// Varios candidatos por producto: los identificadores de Unsplash no se pueden
// deducir, así que se prueban en orden hasta que uno responda.
const candidates: Record<string, string[]> = {
  "Aguardiente de Caña": ["1514362545857-3bc16c4c7d1b", "1608885898957-a559228e8749", "1516535794938-6063878f08cc"],
  "Baguette Tradicional": ["1534620808146-d33bb39128b2", "1571115177098-24ec42ed204d", "1568471173955-8e5b0d2b0b6d"],
  "Croissant de Mantequilla": ["1530610476181-d83430b64dcd", "1549903072-7e6e0bedb7fb", "1568254183919-78a4f43a2877"],
  "Foco LED 12 W": ["1550985616-10810253b84d", "1507473885765-e6ed057f782c", "1524634126442-357e0eac3c14"],
  "Banano Orgánico (kg)": ["1571771894821-ce9b6c11b08e", "1528825871115-3581a5387919", "1587132137056-bfbf0166836e"],
  "Lechuga Crespa (unidad)": ["1622206151226-18ca2c9ab4a1", "1540420773420-3366772f4999", "1556801712-76c8eb07bbc9"],
  "Aceite de Oliva 500 ml": ["1474979266404-7eaacbcd87c5", "1587049352846-4a222e784d38", "1509358271058-acd22cc93898"],
  "Azúcar Rubia 1 kg": ["1581441363689-1f3c3c414635", "1610725664285-7c57e6355d97", "1550989460-0adf9ea622e2"],
  "Papel Higiénico (4 rollos)": ["1584556812952-905ffd0c611a", "1583947215259-38e31be8751f", "1584556326561-c8746083993b"],
};

const url = normalizeSupabaseUrl(process.env.SUPABASE_URL ?? "");
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function responde(candidate: string): Promise<boolean> {
  try {
    const res = await fetch(candidate, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

function portadaSvg(title: string, shop: string): string {
  const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const palabras = title.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    if ((actual + " " + palabra).trim().length > 16) {
      lineas.push(actual.trim());
      actual = palabra;
    } else {
      actual = `${actual} ${palabra}`;
    }
  }
  if (actual.trim()) lineas.push(actual.trim());

  const texto = lineas
    .slice(0, 3)
    .map((linea, i) => `<tspan x="60" dy="${i === 0 ? 0 : 46}">${escapar(linea)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#1e1b4b"/>
  </linearGradient></defs>
  <rect width="600" height="400" fill="url(#g)"/>
  <circle cx="500" cy="80" r="110" fill="#ffffff" opacity="0.06"/>
  <text x="60" y="180" font-family="Georgia, serif" font-size="38" fill="#ffffff">${texto}</text>
  <text x="60" y="350" font-family="Georgia, serif" font-size="19" fill="#ffffff" opacity="0.7">${escapar(shop)}</text>
</svg>`;
}

async function main() {
  const { data, error } = await db
    .from("products")
    .select("id, name, image_url, organization_id, organizations(name)");
  if (error) throw error;

  const rotas: typeof data = [];
  for (const producto of data ?? []) {
    if (!producto.image_url) {
      rotas.push(producto);
      continue;
    }
    if (!(await responde(producto.image_url))) rotas.push(producto);
  }

  console.log(`portadas revisadas: ${data?.length ?? 0}`);
  console.log(`rotas encontradas:  ${rotas.length}\n`);

  for (const producto of rotas) {
    const shop = (producto as any).organizations?.name ?? "";
    let reemplazo: string | null = null;

    for (const id of candidates[producto.name] ?? []) {
      const candidato = `https://images.unsplash.com/photo-${id}${SIZE}`;
      if (await responde(candidato)) {
        reemplazo = candidato;
        break;
      }
    }

    if (!reemplazo) {
      const ruta = `${producto.organization_id}/${producto.id}/portada.svg`;
      const subida = await db.storage
        .from(BUCKET)
        .upload(ruta, portadaSvg(producto.name, shop), { contentType: "image/svg+xml", upsert: true });
      if (subida.error) {
        console.log(`  SIN ARREGLO  ${producto.name}: ${subida.error.message}`);
        continue;
      }
      reemplazo = `${url}/storage/v1/object/public/${BUCKET}/${ruta}`;
      console.log(`  portada propia  ${producto.name}`);
    } else {
      console.log(`  Unsplash        ${producto.name}`);
    }

    const { error: updateError } = await db.from("products").update({ image_url: reemplazo }).eq("id", producto.id);
    if (updateError) console.log(`  ERROR al guardar ${producto.name}: ${updateError.message}`);
  }

  // Segunda pasada: lo que se acaba de escribir tiene que cargar de verdad.
  const { data: final } = await db.from("products").select("name, image_url");
  const sigueRota: string[] = [];
  for (const producto of final ?? []) {
    if (!producto.image_url || !(await responde(producto.image_url))) sigueRota.push(producto.name);
  }

  console.log(
    sigueRota.length === 0
      ? `\nLas ${final?.length ?? 0} portadas del catálogo cargan.`
      : `\nSiguen rotas: ${sigueRota.join(", ")}`,
  );
}

main().catch((error) => {
  console.error("Falló la reparación:", error instanceof Error ? error.message : error);
  process.exit(1);
});
