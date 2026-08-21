import { Sidebar } from "@/components/layout/Sidebar";
import { useStats } from "@/hooks/use-movements";
import { StatCard } from "@/components/ui/StatCard";
import { Package, DollarSign, AlertTriangle, ArrowRightLeft, Eye } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  const chartData = stats?.weeklyActivity ?? [];

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="space-y-4">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground font-display mb-2">Panel de Control</h1>
              <p className="text-muted-foreground">Bienvenido de nuevo, resumen de tu negocio.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/inventario">
                <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 text-sm font-medium">
                  <Eye className="w-4 h-4" />
                  Ver Productos
                </button>
              </Link>
              <div className="px-4 py-2 bg-primary/10 rounded-full text-primary border border-primary/20 text-sm font-medium">
                {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard 
              title="Total Productos" 
              value={stats?.totalProducts || 0}
              icon={Package}
              colorClass="bg-blue-500/20 text-blue-400"
            />
            <StatCard 
              title="Valor Inventario" 
              value={`$${Number(stats?.totalValue || 0).toLocaleString()}`}
              icon={DollarSign}
              colorClass="bg-green-500/20 text-green-400"
            />
            <StatCard 
              title="Alertas Stock Bajo" 
              value={stats?.lowStockCount || 0}
              icon={AlertTriangle}
              colorClass="bg-red-500/20 text-red-400"
              className={stats?.lowStockCount ? "border-red-500/30 ring-1 ring-red-500/20" : ""}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Section */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
              <h3 className="text-xl font-bold font-display text-foreground mb-6">Actividad de Inventario (7 días)</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                      itemStyle={{ color: '#EAB308' }}
                    />
                    <Legend />
                    <Area type="monotone" name="Entradas" dataKey="inbound" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                    <Area type="monotone" name="Salidas" dataKey="outbound" stroke="#ef4444" strokeWidth={3} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Movements */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col">
              <h3 className="text-xl font-bold font-display text-foreground mb-6">Movimientos Recientes</h3>
              <div className="space-y-4 flex-1 overflow-auto pr-2 custom-scrollbar">
                {stats?.recentMovements.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No hay movimientos recientes</p>
                ) : (
                  stats?.recentMovements.map((move: any) => (
                    <div key={move.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-primary/5 transition-colors border border-transparent hover:border-border">
                      <div className={cn(
                        "p-2.5 rounded-lg shrink-0",
                        move.type === 'IN' ? "bg-green-500/10 text-green-400" : 
                        move.type === 'OUT' ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                      )}>
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{move.product?.name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(move.createdAt), "dd MMM, HH:mm", { locale: es })}</p>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-mono font-bold block",
                          move.type === 'IN' ? "text-green-400" : "text-red-400"
                        )}>
                          {move.type === 'IN' ? '+' : '-'}{move.quantity}
                        </span>
                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{move.type}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
