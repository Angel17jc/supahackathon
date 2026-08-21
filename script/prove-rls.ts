/**
 * Prueba de acceso denegado, ejecutada contra la base real con sesiones reales.
 *
 * No usa la clave de servicio salvo donde se indica: cada actor inicia sesión
 * con su correo y su contraseña, igual que lo haría desde el navegador, y las
 * consultas salen con su token. Lo que se demuestra aquí es lo que Postgres
 * decide, no lo que el frontend oculta.
 *
 * Uso: npm run db:prove
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabase-url.js";

const url = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "");
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("Faltan variables en .env");
}

let failures = 0;

function report(label: string, ok: boolean, detail: string) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${label}`);
  console.log(`         ${detail}`);
}

function browser(): SupabaseClient {
  return createClient(url, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = browser();
  const { error } = await client.auth.signInWithPassword({ email, password: "Secreta123" });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return client;
}

async function organizationId(slug: string): Promise<string> {
  const admin = createClient(url, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.from("organizations").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const faroId = await organizationId("licoreria-el-faro");
  const espigaId = await organizationId("panaderia-la-espiga");

  console.log("\n1. Vitrina pública, sin ninguna sesión");
  const anon = browser();

  const catalog = await anon.from("products").select("name, selling_price, image_url");
  report(
    "El catálogo se lee sin cuenta",
    !catalog.error && (catalog.data?.length ?? 0) >= 40,
    catalog.error ? catalog.error.message : `${catalog.data!.length} productos visibles`,
  );

  const margin = await anon.from("products").select("cost_price").limit(1);
  report(
    "El margen de la tienda queda fuera",
    Boolean(margin.error),
    margin.error ? margin.error.message : `EXPUESTO: ${JSON.stringify(margin.data)}`,
  );

  const everything = await anon.from("products").select("*").limit(1);
  report(
    "select * se estrella contra el privilegio por columna",
    Boolean(everything.error),
    everything.error ? everything.error.message : "EXPUESTO",
  );

  const anonReservations = await anon.from("reservations").select("*");
  report(
    "Los apartados no existen para un anónimo",
    Boolean(anonReservations.error) || (anonReservations.data?.length ?? 0) === 0,
    anonReservations.error ? anonReservations.error.message : `${anonReservations.data!.length} filas`,
  );

  console.log("\n2. Cada tienda ve solo sus apartados");
  const faro = await signIn("faro@demo.com");
  const espiga = await signIn("espiga@demo.com");

  const faroOwn = await faro.from("reservations").select("id, organization_id");
  const faroForeign = (faroOwn.data ?? []).filter((row: any) => row.organization_id !== faroId);
  report(
    "El Faro lee sus apartados y ninguno ajeno",
    !faroOwn.error && (faroOwn.data?.length ?? 0) > 0 && faroForeign.length === 0,
    faroOwn.error ? faroOwn.error.message : `${faroOwn.data!.length} apartados, ${faroForeign.length} ajenos`,
  );

  // El ataque explícito: pedir por identificador los de la competencia.
  const faroSpying = await faro.from("reservations").select("id, note").eq("organization_id", espigaId);
  report(
    "El Faro pide los de La Espiga por su identificador",
    !faroSpying.error && (faroSpying.data?.length ?? 0) === 0,
    faroSpying.error ? faroSpying.error.message : `${faroSpying.data!.length} filas devueltas`,
  );

  const espigaOwn = await espiga.from("reservations").select("id, organization_id");
  const espigaForeign = (espigaOwn.data ?? []).filter((row: any) => row.organization_id !== espigaId);
  report(
    "La Espiga tampoco alcanza los de El Faro",
    !espigaOwn.error && espigaForeign.length === 0,
    espigaOwn.error ? espigaOwn.error.message : `${espigaOwn.data!.length} apartados, ${espigaForeign.length} ajenos`,
  );

  console.log("\n3. Cada comprador ve solo los suyos");
  const ana = await signIn("ana@demo.com");
  const diego = await signIn("diego@demo.com");
  const anaId = (await ana.auth.getUser()).data.user!.id;
  const diegoId = (await diego.auth.getUser()).data.user!.id;

  const anaOwn = await ana.from("reservations").select("id, buyer_id");
  const anaForeign = (anaOwn.data ?? []).filter((row: any) => row.buyer_id !== anaId);
  report(
    "Ana lee los suyos, de cualquier tienda",
    !anaOwn.error && (anaOwn.data?.length ?? 0) > 0 && anaForeign.length === 0,
    anaOwn.error ? anaOwn.error.message : `${anaOwn.data!.length} apartados, ${anaForeign.length} ajenos`,
  );

  const anaSpying = await ana.from("reservations").select("id, note").eq("buyer_id", diegoId);
  report(
    "Ana pide los de Diego por su identificador",
    !anaSpying.error && (anaSpying.data?.length ?? 0) === 0,
    anaSpying.error ? anaSpying.error.message : `${anaSpying.data!.length} filas devueltas`,
  );

  // La misma fila tiene dos lectores legítimos, y ninguno más. Sin este
  // contraste, "cero filas" podría explicarse porque la tabla está vacía.
  const faroCount = faroOwn.data?.length ?? 0;
  const anaCount = anaOwn.data?.length ?? 0;
  report(
    "La tabla no está vacía: dos actores distintos alcanzan filas distintas",
    faroCount > 0 && anaCount > 0,
    `El Faro ve ${faroCount}, Ana ve ${anaCount}, y ninguno ve lo del otro lado`,
  );

  console.log("\n4. Apartar en nombre de otro");
  const victimProduct = await ana.from("products").select("id, organization_id").limit(1).single();
  const impersonation = await ana.from("reservations").insert({
    product_id: victimProduct.data!.id,
    organization_id: victimProduct.data!.organization_id,
    buyer_id: diegoId,
    quantity: 1,
    note: "suplantación",
  });
  report(
    "Ana intenta crear un apartado a nombre de Diego",
    Boolean(impersonation.error),
    impersonation.error ? impersonation.error.message : "SE CREÓ, la política no lo impidió",
  );

  console.log("\n5. Storage: escribir en la carpeta de otra tienda");
  const intruso = await espiga.storage
    .from("productos")
    .upload(`${faroId}/9999/intruso.svg`, "<svg xmlns='http://www.w3.org/2000/svg'/>", {
      contentType: "image/svg+xml",
      upsert: true,
    });
  report(
    "La Espiga sube un archivo a la carpeta de El Faro",
    Boolean(intruso.error),
    intruso.error ? intruso.error.message : "SE SUBIÓ, la política de Storage no lo impidió",
  );

  // El bucket tambien limita QUE se sube, no solo quien. Storage aplica estas
  // dos reglas en su propio servidor, antes de tocar la base, asi que valen
  // igual para la clave de servicio: son la unica restriccion del proyecto que
  // esa clave tampoco puede saltarse.
  const tipoProhibido = await espiga.storage
    .from("productos")
    .upload(`${espigaId}/9999/pagina.html`, "<h1>hola</h1>", { contentType: "text/html", upsert: true });
  report(
    "La Espiga sube un HTML en vez de una imagen",
    Boolean(tipoProhibido.error),
    tipoProhibido.error ? tipoProhibido.error.message : "SE SUBIO, el bucket no filtra el tipo",
  );

  const demasiadoGrande = await espiga.storage
    .from("productos")
    .upload(`${espigaId}/9999/grande.png`, new Uint8Array(3 * 1024 * 1024), { contentType: "image/png", upsert: true });
  report(
    "La Espiga sube 3 MB con el limite en 2 MB",
    Boolean(demasiadoGrande.error),
    demasiadoGrande.error ? demasiadoGrande.error.message : "SE SUBIO, el bucket no limita el tamano",
  );

  const propia = await espiga.storage
    .from("productos")
    .upload(`${espigaId}/9999/propia.svg`, "<svg xmlns='http://www.w3.org/2000/svg'/>", {
      contentType: "image/svg+xml",
      upsert: true,
    });
  report(
    "La Espiga sí escribe en la suya",
    !propia.error,
    propia.error ? propia.error.message : "subida correcta",
  );
  await espiga.storage.from("productos").remove([`${espigaId}/9999/propia.svg`]);

  console.log("\n6. Auditoría: reescribir el registro con la clave de servicio");
  const admin = createClient(url, serviceKey!, { auth: { persistSession: false } });
  const written = await admin
    .from("audit_log")
    .insert({ action: "prueba", resource: "prove-rls", outcome: "allowed" })
    .select("id")
    .single();
  if (written.error) {
    report("Se escribe una línea de auditoría", false, written.error.message);
  } else {
    const removal = await admin.from("audit_log").delete().eq("id", written.data.id);
    report(
      "Borrarla, con la clave que salta RLS por diseño",
      Boolean(removal.error),
      removal.error ? removal.error.message : "SE BORRÓ, el registro no es append-only",
    );
  }

  console.log(
    failures === 0
      ? "\nLas 15 comprobaciones pasaron.\n"
      : `\n${failures} comprobación(es) fallaron.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nError inesperado:", error instanceof Error ? error.message : error);
  process.exit(1);
});
