-- Límites del bucket de portadas.
--
-- Las políticas de la migración 009 deciden QUIÉN escribe y DÓNDE, pero no QUÉ.
-- Sin esto, un vendedor autenticado puede dejar un ejecutable de dos gigas en su
-- propia carpeta: la política lo autoriza porque la carpeta es suya.
--
-- Storage aplica estos dos límites en su propio servidor, antes de tocar la
-- base, así que valen igual para la clave de servicio. Es la única restricción
-- del proyecto que la clave de servicio tampoco puede saltarse.

UPDATE storage.buckets
SET
  file_size_limit = 2097152, -- 2 MiB
  -- image/svg+xml sigue permitido porque el seed genera las portadas en SVG.
  -- Un SVG subido por un usuario puede contener scripts; se ejecutarían en el
  -- dominio de Storage y no en el de la aplicación, así que el daño queda
  -- contenido, pero en producción este tipo debería salir de la lista.
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
WHERE id = 'productos';

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'productos';
