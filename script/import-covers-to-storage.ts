/**
 * Trae a Supabase Storage todas las portadas que hoy vive en un dominio ajeno.
 *
 * Que el catálogo dependa de un CDN externo tiene tres costes. El primero es de
 * fondo: el reto pide que Storage sirva al producto, y con las fotos fuera el
 * bucket sostiene las políticas pero no sostiene la vitrina. El segundo es la
 * demo: si el wifi del evento va mal o el CDN responde lento, el catálogo se ve
 * vacío delante del jurado. El tercero es la cabecera CSP, que ha tenido que ir
 * ampliándose para autorizar cada dominio nuevo.
 *
 * Después de esto, la única fuente de imágenes es el bucket, y el CSP puede
 * volver a nombrar solo a Supabase.
 *
 * Uso: npx tsx script/import-covers-to-storage.ts
 * Es idempotente: lo que ya vive en el bucket se salta.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabase-url.js";

const BUCKET = "productos";

const extensiones: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const url = normalizeSupabaseUrl(process.env.SUPABASE_URL ?? "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/**
 * Descarga con reintentos.
 *
 * Bajar cuarenta y seis imágenes seguidas del mismo CDN hace que corte la
 * conexión a mitad: el primer intento de esta migración falló entero por eso.
 * Tres intentos con espera creciente, y una pausa entre productos, convierten un
 * fallo de tanda en, como mucho, un archivo que se reintenta.
 */
async function descargar(direccion: string, intentos = 3): Promise<Response> {
  let ultimo: unknown;
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      return await fetch(direccion);
    } catch (e) {
      ultimo = e;
      await new Promise((listo) => setTimeout(listo, intento * 1500));
    }
  }
  throw ultimo;
}

async function main() {
  const { data, error } = await db.from("products").select("id, name, image_url, organization_id");
  if (error) throw error;

  const externas = (data ?? []).filter((p) => p.image_url && !p.image_url.includes(`/storage/v1/object/public/${BUCKET}/`));
  console.log(`productos: ${data?.length ?? 0}`);
  console.log(`portadas externas por migrar: ${externas.length}\n`);

  let migradas = 0;
  const fallos: string[] = [];

  for (const producto of externas) {
    try {
      const respuesta = await descargar(producto.image_url!);
      if (!respuesta.ok) {
        fallos.push(`${producto.name} (descarga ${respuesta.status})`);
        continue;
      }

      // El tipo lo decide la respuesta, no la extensión de la URL: las de
      // Unsplash no llevan ninguna, y el bucket rechaza lo que no reconoce.
      const tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
      const extension = extensiones[tipo];
      if (!extension) {
        fallos.push(`${producto.name} (tipo ${tipo || "desconocido"})`);
        continue;
      }

      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      const ruta = `${producto.organization_id}/${producto.id}/portada.${extension}`;

      const subida = await db.storage.from(BUCKET).upload(ruta, bytes, { contentType: tipo, upsert: true });
      if (subida.error) {
        fallos.push(`${producto.name} (subida: ${subida.error.message})`);
        continue;
      }

      const publica = `${url}/storage/v1/object/public/${BUCKET}/${ruta}`;
      const { error: guardado } = await db.from("products").update({ image_url: publica }).eq("id", producto.id);
      if (guardado) {
        fallos.push(`${producto.name} (guardar: ${guardado.message})`);
        continue;
      }

      migradas += 1;
      await new Promise((listo) => setTimeout(listo, 250));
      console.log(`  ${String(Math.round(bytes.length / 1024)).padStart(4)} KB  ${producto.name}`);
    } catch (e) {
      fallos.push(`${producto.name} (${(e as Error).message})`);
    }
  }

  console.log(`\nmigradas: ${migradas}`);
  if (fallos.length) {
    console.log(`fallos: ${fallos.length}`);
    for (const f of fallos) console.log(`   ${f}`);
  }

  const { data: finales } = await db.from("products").select("name, image_url");
  const fuera = (finales ?? []).filter((p) => !p.image_url?.includes(`/storage/v1/object/public/${BUCKET}/`));
  console.log(
    fuera.length === 0
      ? `\nLas ${finales?.length ?? 0} portadas se sirven desde Supabase Storage.`
      : `\nSiguen fuera del bucket: ${fuera.map((p) => p.name).join(", ")}`,
  );
}

main().catch((error) => {
  console.error("Falló la migración:", error instanceof Error ? error.message : error);
  process.exit(1);
});
