/**
 * El panel de Supabase muestra la URL del proyecto en varios sitios, y en
 * algunos la presenta con el sufijo de PostgREST (`/rest/v1`). supabase-js
 * espera solo el origen y le anade las rutas por su cuenta, asi que con el
 * sufijo incluido cada peticion sale como `/rest/v1/rest/v1/...` y el servidor
 * responde `Invalid path specified in request URL`.
 *
 * El error aparece en la primera llamada, no al crear el cliente, asi que sin
 * esta normalizacion cualquier script falla con un mensaje que no menciona la
 * variable culpable.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/rest\/v1$/i, "");
}
