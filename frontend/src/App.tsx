import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/modules/inventory/products/InventoryPage";
import Movements from "@/modules/inventory/movements/MovementsPage";
import Categories from "@/modules/catalog/categories/CategoriesPage";
import Platform from "@/modules/platform/PlatformPage";
import ShopPage from "@/modules/marketplace/ShopPage";
import SecurityPage from "@/modules/marketplace/SecurityPage";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import { AuthProvider, useAuth } from "@/lib/auth";

const legacyPathRedirects: Record<string, string> = {
  "/": "/tienda",
  "/inventory": "/inventario",
  "/movements": "/movimientos",
  "/categories": "/categorias",
  "/platform": "/clientes",
};

function CanonicalPathRedirect() {
  const [location, setLocation] = useLocation();
  const canonicalPath = legacyPathRedirects[location];

  useEffect(() => {
    if (canonicalPath) {
      setLocation(canonicalPath, { replace: true });
    }
  }, [canonicalPath, setLocation]);

  return null;
}

function ProtectedRouter() {
  const { session, role, activeOrganization, isLoading, isOrganizationsLoading, isPasswordRecovery } = useAuth();
  const [location, setLocation] = useLocation();
  const isPasswordReset = isPasswordRecovery || window.location.search.includes("reset=1");
  const isPublicRoute = location === "/tienda" || location === "/iniciar-sesion" || location === "/recuperar-acceso" || location === "/restablecer-contrasena";

  useEffect(() => {
    if (isLoading || isOrganizationsLoading) return;

    if (isPasswordReset && location !== "/restablecer-contrasena") {
      setLocation("/restablecer-contrasena?reset=1", { replace: true });
      return;
    }

    if ((!session || !role) && !isPasswordReset && !isPublicRoute) {
      setLocation("/iniciar-sesion", { replace: true });
      return;
    }

    if (session && role && !isPasswordReset && location === "/iniciar-sesion") {
      setLocation("/panel", { replace: true });
    }
  }, [isLoading, isOrganizationsLoading, isPasswordReset, isPublicRoute, location, role, session, setLocation]);

  if (isLoading || isOrganizationsLoading) return <div className="min-h-screen bg-background" />;
  if (isPasswordReset) return <ResetPassword />;
  if (location === "/tienda") return <ShopPage />;
  if (!session || !role) return <Login />;
  if (!activeOrganization) return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-muted-foreground">No tienes una empresa activa asignada.</main>;
  return <Router />;
}

function Router() {
  const { role } = useAuth();
  return (
    <Switch>
      <Route path="/panel" component={Dashboard} />
      <Route path="/inventario" component={Inventory} />
      <Route path="/movimientos" component={Movements} />
      <Route path="/categorias" component={Categories} />
      <Route path="/seguridad" component={SecurityPage} />
      {role === "platform_admin" && <Route path="/clientes" component={Platform} />}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CanonicalPathRedirect />
        <TooltipProvider>
          <Toaster />
          <ProtectedRouter />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
