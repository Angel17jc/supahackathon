import { useState } from "react";
import { useLocation } from "wouter";
import { Store, Search, Package, LogIn, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Shop {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

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

async function fetchShops(): Promise<Shop[]> {
  const res = await fetch("/api/catalog/shops");
  if (!res.ok) throw new Error("No se pudieron cargar las tiendas");
  return res.json();
}

async function fetchCatalog(shopId?: string, search?: string): Promise<CatalogProduct[]> {
  const params = new URLSearchParams();
  if (shopId) params.set("shop", shopId);
  if (search) params.set("search", search);
  const res = await fetch(`/api/catalog?${params.toString()}`);
  if (!res.ok) throw new Error("No se pudo cargar el catálogo");
  return res.json();
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <div className="group rounded-2xl border border-border/50 bg-card overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20">
      <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Package className="w-12 h-12 text-muted-foreground/30" />
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground line-clamp-1">{product.name}</h3>
          <span className="text-lg font-bold text-primary whitespace-nowrap">
            ${Number(product.sellingPrice).toFixed(2)}
          </span>
        </div>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Badge variant="secondary" className="text-xs">
            {product.shopName}
          </Badge>
          {product.categoryName && (
            <Badge variant="outline" className="text-xs">
              {product.categoryName}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function ShopCard({ shop, isSelected, onClick }: { shop: Shop; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
        isSelected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/50 bg-card hover:border-primary/30 hover:bg-card/80"
      }`}
    >
      <Store className="w-5 h-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{shop.name}</p>
        <p className="text-xs text-muted-foreground">{shop.productCount} productos</p>
      </div>
    </button>
  );
}

export default function ShopPage() {
  const [, setLocation] = useLocation();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Carga inicial
  useState(() => {
    Promise.all([fetchShops(), fetchCatalog()]).then(([s, p]) => {
      setShops(s);
      setProducts(p);
    }).finally(() => {
      setLoading(false);
      setLoadingProducts(false);
    });
  });

  function handleShopClick(shopId: string | null) {
    const next = shopId === selectedShop ? null : shopId;
    setSelectedShop(next);
    setLoadingProducts(true);
    fetchCatalog(next ?? undefined, search || undefined).then(setProducts).finally(() => setLoadingProducts(false));
  }

  function handleSearch(value: string) {
    setSearch(value);
    setLoadingProducts(true);
    fetchCatalog(selectedShop ?? undefined, value || undefined).then(setProducts).finally(() => setLoadingProducts(false));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl ring-1 ring-primary/50">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-wide text-white">ENVY</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Marketplace</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/iniciar-sesion")}
            className="gap-2"
          >
            <LogIn className="w-4 h-4" />
            Iniciar sesión
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold font-display text-white">
            Productos del barrio
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Descubre lo que las tiendas de tu barrio tienen para ofrecer.
          </p>
        </div>

        {/* Búsqueda */}
        <div className="max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tiendas */}
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-48 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => handleShopClick(null)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all shrink-0 ${
                selectedShop === null
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-card hover:border-primary/30"
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium text-sm">Todas</span>
            </button>
            {shops.map((shop) => (
              <div key={shop.id} className="shrink-0">
                <ShopCard
                  shop={shop}
                  isSelected={selectedShop === shop.id}
                  onClick={() => handleShopClick(shop.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Productos */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
