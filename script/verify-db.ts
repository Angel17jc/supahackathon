/**
 * Comprueba que la base Supabase configurada en .env quedo bien inicializada.
 *
 * Hace dos pasadas con credenciales distintas:
 *   - clave de servicio: debe ver los datos (confirma que el esquema existe).
 *   - clave publica anonima: NO debe ver nada (confirma que RLS y los REVOKE
 *     de la migracion 006 estan activos).
 *
 * La segunda pasada es la prueba de acceso denegado: si una tabla responde con
 * filas usando solo la clave publica, cualquiera que abra la aplicacion puede
 * leerla desde la consola del navegador.
 *
 * Uso: npx tsx script/verify-db.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabase-url.js";

// Lo que sigue cerrado al navegador. El catálogo ya no está en esta lista: se
// abrió a propósito en la migración 009, y comprobarlo aquí daría un falso
// negativo cada vez.
const privateTables = ["organization_memberships", "profiles", "reservations", "audit_log"] as const;

// Lo que la vitrina necesita que sea legible sin cuenta.
const publicTables = ["products", "categories", "organizations"] as const;

// PostgREST resuelve las funciones por nombre Y aridad, asi que una llamada sin
// argumentos responde "no existe" aunque la funcion este creada. La sonda usa la
// firma completa con una organizacion inexistente: valida y lanza P0002 antes de
// tocar una sola fila, asi que comprobar no escribe nada.
const missingOrganization = "00000000-0000-0000-0000-000000000000";

const rpcProbes = [
  {
    name: "create_inventory_movement",
    args: { p_organization_id: missingOrganization, p_product_id: -1, p_type: "IN", p_quantity: 1 },
  },
] as const;

let failures = 0;

function pass(message: string) {
  console.log(`  OK    ${message}`);
}

function fail(message: string) {
  failures += 1;
  console.log(`  FALLA ${message}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail(`${name} no esta definida en .env`);
    return "";
  }
  return value;
}

async function main() {
  console.log("\n1. Variables de entorno");
  const rawServerUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const rawBrowserUrl = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");

  if (!rawServerUrl || !serviceKey || !rawBrowserUrl || !anonKey) {
    console.log("\nCompleta .env antes de continuar.");
    process.exit(1);
  }

  // Una clave sin reemplazar pasa las comprobaciones de formato y despues
  // falla en la primera peticion con un error que no la senala como culpable.
  if (anonKey.includes("PEGA_AQUI") || anonKey.includes("your-")) {
    fail("VITE_SUPABASE_ANON_KEY sigue siendo el marcador de posicion");
    console.log("Completa .env antes de continuar.");
    process.exit(1);
  }

  // El panel muestra la URL con el sufijo /rest/v1 en algunas vistas. El
  // servidor Express lo tolera desde siempre; estos scripts no lo hacian y
  // fallaban con "Invalid path specified in request URL".
  const serverUrl = normalizeSupabaseUrl(rawServerUrl);
  const browserUrl = normalizeSupabaseUrl(rawBrowserUrl);

  if (serverUrl !== rawServerUrl.trim() || browserUrl !== rawBrowserUrl.trim()) {
    fail("La URL lleva el sufijo /rest/v1. Deja solo https://<proyecto>.supabase.co");
  }

  if (serverUrl !== browserUrl) {
    fail("SUPABASE_URL y VITE_SUPABASE_URL apuntan a proyectos distintos");
  } else {
    pass(`Ambas claves apuntan a ${serverUrl}`);
  }

  // Una clave de servicio en una variable VITE_* se publica en el bundle del
  // navegador y entrega acceso total a cualquiera que abra la aplicacion.
  if (anonKey.startsWith("sb_secret_") || anonKey === serviceKey) {
    fail("VITE_SUPABASE_ANON_KEY contiene la clave secreta. Usa la publicable.");
  } else {
    pass("VITE_SUPABASE_ANON_KEY no es la clave secreta");
  }

  const service = createClient(serverUrl, serviceKey, { auth: { persistSession: false } });
  const anonymous = createClient(browserUrl, anonKey, { auth: { persistSession: false } });

  console.log("\n2. Esquema (clave de servicio)");
  for (const table of [...privateTables, ...publicTables]) {
    const { count, error } = await service.from(table).select("*", { count: "exact", head: true });
    if (error) fail(`${table}: ${error.message}`);
    else pass(`${table}: ${count ?? 0} filas`);
  }

  console.log("\n3. Funciones atomicas");
  for (const probe of rpcProbes) {
    const { error } = await service.rpc(probe.name, probe.args as Record<string, unknown>);
    // PGRST202 es el unico codigo que significa "no esta en el esquema".
    // Cualquier otro error viene de dentro de la funcion, o sea que existe.
    if (error && (error.code === "PGRST202" || /schema cache/i.test(error.message))) {
      fail(`${probe.name} no existe (falta el paso 8 del bootstrap)`);
    } else {
      pass(`${probe.name} existe`);
    }
  }

  console.log("\n4. Lo que la clave publica alcanza, y lo que no");
  // La comprobacion dejo de ser "todo cerrado". Un marketplace necesita que el
  // catalogo se lea sin cuenta, asi que lo que hay que verificar es que este
  // abierto exactamente lo previsto y nada mas.
  for (const table of privateTables) {
    const { data, error } = await anonymous.from(table).select("*").limit(1);
    if (error) {
      pass(`${table}: cerrada (${error.message})`);
    } else if (!data || data.length === 0) {
      pass(`${table}: sin filas visibles`);
    } else {
      fail(`${table}: EXPUESTA, devolvio ${data.length} fila(s) sin autenticacion`);
    }
  }

  const catalog = await anonymous.from("products").select("name, selling_price").limit(5);
  if (catalog.error || !catalog.data?.length) {
    fail(`La vitrina no se lee sin cuenta: ${catalog.error?.message ?? "0 productos"}`);
  } else {
    pass(`products: ${catalog.data.length} productos visibles sin cuenta (asi debe ser)`);
  }

  // El precio al que la tienda compro. Filtrado, un competidor sabe cuanto bajar
  // para hundirla, y ninguna politica de filas lo protege: es un privilegio de
  // columna.
  const margin = await anonymous.from("products").select("cost_price").limit(1);
  if (margin.error) {
    pass(`cost_price: denegado (${margin.error.message})`);
  } else {
    fail(`cost_price: EXPUESTO, ${JSON.stringify(margin.data)}`);
  }

  const everything = await anonymous.from("products").select("*").limit(1);
  if (everything.error) {
    pass(`select *: denegado (${everything.error.message})`);
  } else {
    fail("select *: EXPUESTO, el privilegio por columna no esta aplicado");
  }

  console.log("\n5. Cuentas disponibles");
  const { data: userList, error: userError } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (userError) {
    fail(`No se pudo listar usuarios: ${userError.message}`);
  } else if (userList.users.length === 0) {
    fail("No hay usuarios. Corre script/bootstrap-admin.ts");
  } else {
    for (const user of userList.users) {
      const platformRole = (user.app_metadata as Record<string, unknown>)?.platform_role;
      pass(`${user.email}${platformRole ? ` [${String(platformRole)}]` : ""}`);
    }
  }

  console.log(failures === 0 ? "\nTodo correcto.\n" : `\n${failures} comprobacion(es) fallaron.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nError inesperado:", error instanceof Error ? error.message : error);
  process.exit(1);
});
