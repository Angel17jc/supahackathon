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

const tables = [
  "organizations",
  "organization_memberships",
  "categories",
  "suppliers",
  "products",
  "movements",
  "credit_accounts",
  "credit_payments",
] as const;

// PostgREST resuelve las funciones por nombre Y aridad, asi que una llamada sin
// argumentos responde "no existe" aunque la funcion este creada. Cada sonda usa
// la firma completa con una organizacion inexistente: las tres validan y lanzan
// P0002 antes de tocar una sola fila, asi que comprobar no escribe nada.
const missingOrganization = "00000000-0000-0000-0000-000000000000";

const rpcProbes = [
  {
    name: "create_inventory_movement",
    args: { p_organization_id: missingOrganization, p_product_id: -1, p_type: "IN", p_quantity: 1 },
  },
  {
    name: "create_credit_sale",
    args: { p_organization_id: missingOrganization, p_product_id: -1, p_customer_name: "sonda", p_quantity: 1 },
  },
  {
    name: "register_credit_payment",
    args: { p_organization_id: missingOrganization, p_credit_account_id: -1, p_amount: 1 },
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
  for (const table of tables) {
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

  console.log("\n4. Acceso denegado con la clave publica");
  for (const table of tables) {
    const { data, error } = await anonymous.from(table).select("*").limit(1);
    if (error) {
      pass(`${table}: bloqueada (${error.message})`);
    } else if (!data || data.length === 0) {
      pass(`${table}: sin filas visibles`);
    } else {
      fail(`${table}: EXPUESTA, devolvio ${data.length} fila(s) sin autenticacion`);
    }
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
