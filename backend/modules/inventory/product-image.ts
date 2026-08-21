import { recordAudit } from "../../audit.js";

const BUCKET = "productos";
const publicPrefix = `/storage/v1/object/public/${BUCKET}/`;

/**
 * Comprueba que una portada pertenece a la tienda que dice ser suya.
 *
 * La subida ocurre en el navegador con el token del vendedor, y la política
 * `productos_write_own_folder` ya impide escribir en la carpeta de otra tienda.
 * Lo que esa política no puede impedir es que, una vez subido un archivo legal,
 * la fila del producto apunte a otra parte: a la portada de un competidor, o a
 * un dominio ajeno que registre a cada visitante del catálogo.
 *
 * Por eso subir y registrar están separados. El navegador manda el archivo, el
 * servidor decide qué URL se guarda.
 */
export function isOwnedProductImage(imageUrl: string, organizationId: string): boolean {
  const index = imageUrl.indexOf(publicPrefix);
  if (index === -1) return false;

  const objectPath = imageUrl.slice(index + publicPrefix.length);
  const [folder] = objectPath.split("/");
  return folder === organizationId;
}

export async function rejectForeignImage(
  imageUrl: string | null | undefined,
  context: { organizationId: string; actorId: string; actorEmail?: string; productId?: number },
): Promise<string | null> {
  if (!imageUrl) return null;
  if (isOwnedProductImage(imageUrl, context.organizationId)) return null;

  await recordAudit({
    actorId: context.actorId,
    actorEmail: context.actorEmail ?? null,
    organizationId: context.organizationId,
    action: "asignar portada ajena",
    resource: "products",
    resourceId: context.productId ? String(context.productId) : null,
    outcome: "denied",
    detail: { imageUrl },
  });

  return "La portada debe estar subida en la carpeta de tu tienda";
}
