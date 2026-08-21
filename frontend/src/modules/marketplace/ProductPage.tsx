import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Store, ArrowLeft, Package, ShoppingCart, Plus, Minus, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

interface CatalogProduct {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  sellingPrice: string;
  imageUrl: string | null;
  categoryName: string | null;
  shopId: string;
  shopName: string;
  shopSlug: string;
}

async function fetchProduct(id: number): Promise<CatalogProduct | null> {
  const res = await fetch(`/api/catalog/${id}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchRelated(shopId: string, excludeId: number): Promise<CatalogProduct[]> {
  const res = await fetch(`/api/catalog?shop=${shopId}`);
  if (!res.ok) return [];
  const all: CatalogProduct[] = await res.json();
  return all.filter((p) => p.id !== excludeId).slice(0, 4);
}

export default function ProductPage() {
  const [, params] = useRoute("/producto/:id");
  const [, setLocation] = useLocation();
  const productId = Number(params?.id);

  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [related, setRelated] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    fetchProduct(productId).then((p) => {
      setProduct(p);
      if (p) fetchRelated(p.shopId, p.id).then(setRelated);
    }).finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Skeleton className="aspect-[4/3] rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Producto no encontrado</p>
        <Button variant="outline" onClick={() => setLocation("/tienda")}>
          Volver a la vitrina
        </Button>
      </div>
    );
  }

  const stockLabel =
    product.quantity === 0
      ? "Agotado"
      : product.quantity <= 5
      ? `Solo quedan ${product.quantity}`
      : `${product.quantity} unidades disponibles`;

  const stockVariant =
    product.quantity === 0 ? "destructive" : product.quantity <= 5 ? "secondary" : "outline";

  async function handleReserve() {
    if (!product) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLocation("/iniciar-sesion");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo crear el apartado");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Error al apartar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/tienda")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver a la vitrina</span>
          </button>
          <button
            onClick={() => setLocation("/tienda")}
            className="flex items-center gap-2"
          >
            <div className="bg-primary/20 p-1.5 rounded-lg ring-1 ring-primary/50">
              <Store className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-bold font-display tracking-wide text-foreground">ENVY</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Producto principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Imagen */}
          <div className="rounded-2xl overflow-hidden bg-muted/30 border border-border/50">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-auto object-cover aspect-[4/3]"
              />
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center">
                <Package className="w-24 h-24 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{product.shopName}</Badge>
                {product.categoryName && <Badge variant="outline">{product.categoryName}</Badge>}
              </div>
              <h1 className="text-3xl font-bold font-display text-foreground">{product.name}</h1>
              <p className="text-3xl font-bold text-primary mt-2">
                ${Number(product.sellingPrice).toFixed(2)}
              </p>
            </div>

            <Separator />

            {/* Descripción */}
            {product.description && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Descripción
                </h3>
                <p className="text-foreground leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Detalles */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {product.sku && (
                <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">SKU</span>
                  <p className="font-medium mt-0.5">{product.sku}</p>
                </div>
              )}
              <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">Stock</span>
                <p className="font-medium mt-0.5">
                  <Badge variant={stockVariant as any} className="mt-0.5">{stockLabel}</Badge>
                </p>
              </div>
            </div>

            <Separator />

            {/* Apartar */}
            {success ? (
              <div className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/20 p-5">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-600">Apartado creado</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Revisa "Mis apartados" para ver el estado de tu solicitud.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Cantidad:</span>
                  <div className="flex items-center border rounded-xl">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="px-4 py-2.5 hover:bg-muted disabled:opacity-30 transition-colors rounded-l-xl"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-6 py-2.5 text-sm font-medium min-w-[50px] text-center border-x">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(product.quantity, q + 1))}
                      disabled={quantity >= product.quantity}
                      className="px-4 py-2.5 hover:bg-muted disabled:opacity-30 transition-colors rounded-r-xl"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <Button
                  onClick={handleReserve}
                  disabled={submitting || product.quantity === 0}
                  className="w-full gap-2 h-12 text-base"
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5" />
                  )}
                  {product.quantity === 0
                    ? "Agotado"
                    : submitting
                    ? "Apartando..."
                    : "Me interesa"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Productos relacionados de la misma tienda */}
        {related.length > 0 && (
          <div className="mt-16">
            <Separator className="mb-8" />
            <h2 className="text-xl font-bold font-display text-foreground mb-6">
              Más de {product.shopName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setLocation(`/producto/${item.id}`);
                    window.scrollTo(0, 0);
                  }}
                  className="group rounded-2xl border border-border/50 bg-card overflow-hidden text-left transition-all hover:shadow-lg hover:border-primary/20"
                >
                  <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center overflow-hidden">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-medium text-sm line-clamp-1">{item.name}</h3>
                    <p className="text-primary font-bold">${Number(item.sellingPrice).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
