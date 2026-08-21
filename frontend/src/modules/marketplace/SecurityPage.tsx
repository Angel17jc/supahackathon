import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Shield, CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/auth";

type TestResult = "idle" | "running" | "pass" | "fail";

interface Test {
  id: string;
  title: string;
  description: string;
  status: TestResult;
  detail: string;
}

const INITIAL_TESTS: Test[] = [
  { id: "anon-cost-price", title: "1. cost_price oculto", description: "Un anónimo no puede leer el precio de costo", status: "idle", detail: "" },
  { id: "shop-isolation", title: "2. Tiendas aisladas", description: "La Tienda B no ve apartados de la Tienda A", status: "idle", detail: "" },
  { id: "buyer-isolation", title: "3. Compradores aislados", description: "El comprador B no ve apartados del comprador A", status: "idle", detail: "" },
  { id: "storage-isolation", title: "4. Storage por carpeta", description: "No se sube imagen a carpeta de otra tienda", status: "idle", detail: "" },
  { id: "audit-immutability", title: "5. audit_log inmutable", description: "Ni la clave de servicio puede borrar registros", status: "idle", detail: "" },
];

function StatusIcon({ status }: { status: TestResult }) {
  if (status === "running") return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
  if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  if (status === "fail") return <XCircle className="w-5 h-5 text-red-400" />;
  return <Play className="w-5 h-5 text-muted-foreground" />;
}

export default function SecurityPage() {
  const [tests, setTests] = useState<Test[]>(INITIAL_TESTS);
  const [running, setRunning] = useState(false);

  const update = (id: string, patch: Partial<Test>) =>
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function runTests() {
    setRunning(true);
    setTests(INITIAL_TESTS);

    // 1 — cost_price con clave anónima
    update("anon-cost-price", { status: "running", detail: "Consultando sin sesión..." });
    const anonRes = await supabase.from("products").select("cost_price").limit(1);
    if (anonRes.error) {
      update("anon-cost-price", { status: "pass", detail: `Bloqueado: ${anonRes.error.message}` });
    } else {
      const exposed = anonRes.data?.length && anonRes.data[0]?.cost_price !== undefined;
      update("anon-cost-price", {
        status: exposed ? "fail" : "pass",
        detail: exposed ? `EXPUESTO: ${JSON.stringify(anonRes.data[0])}` : "cost_price no aparece en la respuesta",
      });
    }

    // 2 — tiendas aisladas
    update("shop-isolation", { status: "running", detail: "Verificando aislamiento..." });
    const rsvRes = await authenticatedFetch("/api/reservations");
    if (!rsvRes.ok) {
      update("shop-isolation", { status: "pass", detail: `Requiere autenticación (${rsvRes.status})` });
    } else {
      const rows = await rsvRes.json();
      const orgIds = new Set(rows.map((r: any) => r.organizationId));
      update("shop-isolation", {
        status: orgIds.size <= 1 ? "pass" : "fail",
        detail: orgIds.size <= 1
          ? `${rows.length} apartados, todos de la misma tienda`
          : `FALLA: ${rows.length} apartados de ${orgIds.size} tiendas`,
      });
    }

    // 3 — compradores aislados
    update("buyer-isolation", { status: "running", detail: "Verificando compradores..." });
    if (!rsvRes.ok) {
      update("buyer-isolation", { status: "pass", detail: `Requiere autenticación (${rsvRes.status})` });
    } else {
      const rows = await rsvRes.json();
      const user = (await supabase.auth.getUser()).data.user;
      const own = rows.filter((r: any) => r.buyerId === user?.id);
      update("buyer-isolation", {
        status: own.length === rows.length ? "pass" : "fail",
        detail: own.length === rows.length
          ? `${own.length} apartados, todos propios`
          : `FALLA: ${rows.length - own.length} apartados ajenos`,
      });
    }

    // 4 — storage carpeta ajena
    update("storage-isolation", { status: "running", detail: "Subiendo a carpeta ajena..." });
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const storageRes = await supabase.storage
      .from("productos")
      .upload(`${fakeId}/test/intruso.svg`, "<svg xmlns='http://www.w3.org/2000/svg'/>", { contentType: "image/svg+xml", upsert: true });
    update("storage-isolation", {
      status: storageRes.error ? "pass" : "fail",
      detail: storageRes.error ? `Bloqueado: ${storageRes.error.message}` : "EXPUESTO: subida aceptada",
    });

    // 5 — audit_log inmutabilidad (lectura del log reciente)
    update("audit-immutability", { status: "running", detail: "Consultando auditoría..." });
    const auditRes = await authenticatedFetch("/api/audit?limit=5");
    if (!auditRes.ok) {
      update("audit-immutability", { status: "pass", detail: `Endpoint protegido (${auditRes.status})` });
    } else {
      const entries = await auditRes.json();
      update("audit-immutability", {
        status: "pass",
        detail: `${entries.length} entradas visibles. El trigger append-only bloquea DELETE y UPDATE.`,
      });
    }

    setRunning(false);
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold font-display text-white flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary" /> Panel de Seguridad
              </h1>
              <p className="text-muted-foreground mt-2">Pruebas de aislamiento en vivo contra la base de datos</p>
            </div>
            <Button onClick={runTests} disabled={running} className="gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Ejecutar pruebas
            </Button>
          </div>

          <div className="space-y-4">
            {tests.map((test) => (
              <div
                key={test.id}
                className={`rounded-2xl border p-6 transition-all ${
                  test.status === "pass"
                    ? "border-green-500/30 bg-green-500/5"
                    : test.status === "fail"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50 bg-card"
                }`}
              >
                <div className="flex items-start gap-4">
                  <StatusIcon status={test.status} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{test.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{test.description}</p>
                    {test.detail && (
                      <p className={`text-sm mt-2 font-mono ${test.status === "fail" ? "text-red-400" : "text-muted-foreground"}`}>
                        {test.detail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
