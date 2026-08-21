/**
 * Crea usuarios y organizaciones en una base Supabase recien inicializada.
 *
 * Una base nueva no tiene usuarios: sin este paso ningun endpoint de
 * /api/platform/* responde, porque todos exigen un administrador de plataforma.
 * El rol de plataforma vive en app_metadata, que solo la clave de servicio
 * puede escribir, asi que este script corre en el servidor y nunca en el
 * navegador.
 *
 * Uso:
 *   npx tsx script/bootstrap-admin.ts --email admin@demo.com --password Secreta123 --platform-admin
 *   npx tsx script/bootstrap-admin.ts --email cajero@demo.com --password Secreta123 \
 *     --org-name "Tienda Norte" --org-slug tienda-norte --role cashier
 *
 * Es idempotente: reutiliza el usuario, la organizacion y la membresia si ya existen.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../shared/supabase-url.js";

const organizationRoles = ["owner", "manager", "cashier"] as const;
type OrganizationRole = (typeof organizationRoles)[number];

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  let current: string | undefined;
  for (const token of argv) {
    if (token.startsWith("--")) {
      current = token.slice(2);
      flags[current] = true;
      continue;
    }
    if (!current) continue;
    // `npm run db:admin -- --org-name "Tienda Norte"` llega a Node como dos
    // argumentos sueltos: PowerShell consume las comillas antes de que npm
    // reenvie la linea. Reunir los valores sucesivos evita que el nombre se
    // trunque en "Tienda" sin avisar.
    const existing = flags[current];
    flags[current] = existing === true ? token : `${existing as string} ${token}`;
  }
  return flags;
}

function requireString(flags: Record<string, string | boolean>, name: string): string {
  const value = flags[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta --${name}. Ejemplo: --${name} valor`);
  }
  return value.trim();
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const rawUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceKey) {
    throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar en .env");
  }
  const url = normalizeSupabaseUrl(rawUrl);

  const email = requireString(flags, "email");
  const password = requireString(flags, "password");
  const isPlatformAdmin = flags["platform-admin"] === true;
  const orgName = typeof flags["org-name"] === "string" ? flags["org-name"] : "Inventario existente";
  const orgSlug = typeof flags["org-slug"] === "string" ? flags["org-slug"] : "legacy-inventory";
  const role = (typeof flags.role === "string" ? flags.role : "owner") as OrganizationRole;

  if (!organizationRoles.includes(role)) {
    throw new Error(`--role debe ser uno de: ${organizationRoles.join(", ")}`);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Usuario. createUser falla si el correo ya existe, asi que buscamos primero.
  let userId: string | undefined;
  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (existing.error) throw existing.error;
  const match = existing.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  const appMetadata = isPlatformAdmin ? { platform_role: "platform_admin" } : {};

  if (match) {
    userId = match.id;
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      app_metadata: appMetadata,
    });
    if (updated.error) throw updated.error;
    console.log(`· Usuario existente actualizado: ${email} (${userId})`);
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    console.log(`· Usuario creado: ${email} (${userId})`);
  }

  if (isPlatformAdmin) {
    console.log("· Rol de plataforma: platform_admin");
  }

  // 2. Organizacion. La migracion 003 ya crea 'legacy-inventory'; cualquier otra
  //    se crea aqui para poder demostrar el aislamiento entre tenants.
  const found = await admin.from("organizations").select("id, name").eq("slug", orgSlug).maybeSingle();
  if (found.error) throw found.error;

  let organizationId: string;
  if (found.data) {
    organizationId = found.data.id;
    console.log(`· Organizacion existente: ${found.data.name} (${orgSlug})`);
  } else {
    const inserted = await admin
      .from("organizations")
      .insert({ name: orgName, slug: orgSlug })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    organizationId = inserted.data.id;
    console.log(`· Organizacion creada: ${orgName} (${orgSlug})`);
  }

  // 3. Membresia. El administrador de plataforma ve todo sin membresia, pero
  //    darsela igual permite entrar a la organizacion desde la interfaz.
  const membership = await admin
    .from("organization_memberships")
    .upsert(
      { organization_id: organizationId, user_id: userId, role, status: "active" },
      { onConflict: "organization_id,user_id" },
    )
    .select("id")
    .single();
  if (membership.error) throw membership.error;
  console.log(`· Membresia asegurada con rol "${role}"`);

  console.log("\nListo. Inicia sesion con:");
  console.log(`  correo:      ${email}`);
  console.log(`  contrasena:  ${password}`);
  console.log(`  organizacion: ${organizationId}`);
}

main().catch((error) => {
  console.error("\nFallo el bootstrap:", error instanceof Error ? error.message : error);
  process.exit(1);
});
