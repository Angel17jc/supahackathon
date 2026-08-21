import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useMovements, useCreateMovement } from "@/modules/inventory/movements/movement-queries";
import { useProducts } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMovementSchema } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Schema for the movement form
const formSchema = insertMovementSchema.extend({
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1"),
  productId: z.coerce.number().min(1, "Selecciona un producto"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
});

type MovementFormValues = z.infer<typeof formSchema>;

export default function Movements() {
  const { data: movements, isLoading } = useMovements();
  const { data: products } = useProducts();
  const createMovement = useCreateMovement();

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "IN",
      quantity: 1,
      reason: "",
    },
  });

  function onSubmit(data: MovementFormValues) {
    createMovement.mutate(data, {
      onSuccess: () => {
        form.reset({
          type: "IN",
          quantity: 1,
          reason: "",
        });
      },
    });
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-display text-white mb-2">Movimientos de Stock</h1>
            <p className="text-muted-foreground">Registra entradas y salidas de mercancía.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <Card className="bg-card border-border shadow-xl h-fit">
              <CardHeader>
                <CardTitle className="text-primary font-display">Registrar Movimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Movimiento</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="IN">Entrada (Compra)</SelectItem>
                              <SelectItem value="OUT">Salida (Venta)</SelectItem>
                              <SelectItem value="ADJUSTMENT">Ajuste (Pérdida/Regalo)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="productId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Producto</FormLabel>
                          <Select onValueChange={(val) => field.onChange(Number(val))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Buscar producto..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products?.map((prod) => (
                                <SelectItem key={prod.id} value={String(prod.id)}>
                                  {prod.name} (Stock: {prod.quantity})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razón / Nota (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. Factura #1234" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={createMovement.isPending} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
                      {createMovement.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Registrar
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* History Section */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
              <h3 className="text-xl font-bold font-display text-white mb-6">Historial Reciente</h3>
              
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : movements?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay movimientos registrados.</p>
                ) : (
                  movements?.map((move) => (
                    <div key={move.id} className="flex items-center gap-4 p-4 rounded-xl bg-background/30 border border-white/5 hover:border-white/10 transition-colors">
                      <div className={cn(
                        "p-3 rounded-xl shrink-0",
                        move.type === 'IN' ? "bg-green-500/10 text-green-400" : 
                        move.type === 'OUT' ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                      )}>
                        {move.type === 'IN' ? <ArrowUp className="w-5 h-5" /> : 
                         move.type === 'OUT' ? <ArrowDown className="w-5 h-5" /> : 
                         <RefreshCw className="w-5 h-5" />}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{move.product?.name}</h4>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          {move.createdAt && <span>{format(new Date(move.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}</span>}
                          {move.reason && (
                            <>
                              <span>•</span>
                              <span>{move.reason}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={cn(
                          "text-lg font-bold font-mono",
                          move.type === 'IN' ? "text-green-400" : "text-red-400"
                        )}>
                          {move.type === 'IN' ? '+' : '-'}{move.quantity}
                        </span>
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
