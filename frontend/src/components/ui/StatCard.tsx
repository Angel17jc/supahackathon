import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  colorClass?: string;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className, colorClass = "bg-primary/20 text-primary" }: StatCardProps) {
  return (
    <div className={cn(
      "glass-panel rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-2xl relative overflow-hidden group",
      className
    )}>
      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold font-display text-foreground tracking-tight">{value}</h3>
          
          {trend && (
            <div className="flex items-center mt-2 gap-2">
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                trendUp ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              )}>
                {trend}
              </span>
              <span className="text-xs text-muted-foreground">vs mes anterior</span>
            </div>
          )}
        </div>
        
        <div className={cn("p-3 rounded-xl shadow-lg ring-1 ring-white/10", colorClass)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
