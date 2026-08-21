import { useRef, useState } from "react";
import { Loader2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const BUCKET = "productos";
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

interface ProductImageUploadProps {
  value: string;
  onChange: (imageUrl: string) => void;
}

/**
 * Sube la portada directamente a Storage con la sesión del vendedor.
 *
 * Deliberadamente no pasa por la API. Si el archivo viajara a Express, la subida
 * la haría la clave de servicio, que salta las políticas de Storage por diseño,
 * y `productos_write_own_folder` quedaría escrita pero nunca ejercida. Yendo
 * directo, quien autoriza cada subida es Postgres, con el token de quien la
 * pide: intentar escribir en la carpeta de otra tienda falla aquí, en la
 * aplicación, y no solo en un script de prueba.
 *
 * El servidor conserva la última palabra: es él quien guarda `image_url` en la
 * fila, y solo si la ruta pertenece a la carpeta de su tienda.
 */
export function ProductImageUpload({ value, onChange }: ProductImageUploadProps) {
  const { activeOrganization } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    // Las mismas dos reglas viven en el bucket (migración 010). Comprobarlas
    // aquí solo evita el viaje de subida; la que manda es la del servidor.
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato no admitido. Usa PNG, JPG o WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 2 MB.`);
      return;
    }
    if (!activeOrganization) {
      setError("Selecciona una tienda antes de subir la portada.");
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
      // El nombre lleva la marca de tiempo para que reemplazar la portada no
      // choque con la copia que el navegador ya tenga en caché.
      const path = `${activeOrganization.id}/nuevas/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        // El mensaje crudo de Postgres es más útil que uno inventado: si alguien
        // manipula la ruta, aquí se lee la política que lo impidió.
        setError(`Storage rechazó la subida: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />

      {value ? (
        <div className="relative w-full overflow-hidden rounded-md border border-border">
          <img src={value} alt="Portada del producto" className="h-40 w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onChange("")}
            aria-label="Quitar portada"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {isUploading ? "Subiendo…" : "Subir portada"}
          <span className="text-xs">PNG, JPG o WebP · máximo 2 MB</span>
        </button>
      )}

      {value && (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
          {isUploading ? "Subiendo…" : "Reemplazar portada"}
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
