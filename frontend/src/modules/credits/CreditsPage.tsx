import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useCredits, useCreditsStats, useCreateCredit, useCreatePayment } from "./credit-queries";
import { useProducts } from "@/modules/inventory/products/product-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Users, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CreditAccountWithDetails } from "@shared/schema";

export default function Credits() {
  const { data: credits = [], isLoading } = useCredits();
  const { data: stats } = useCreditsStats();
  const { data: products = [] } = useProducts();
  const createCredit = useCreateCredit();
  const createPayment = useCreatePayment();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditAccountWithDetails | null>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    productId: "",
    quantity: "",
    notes: "",
  });

  const [paymentData, setPaymentData] = useState({
    amount: "",
    paymentMethod: "",
    notes: "",
  });

  const handleCreateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCredit.mutateAsync({
        customerName: formData.customerName,
        productId: parseInt(formData.productId),
        quantity: parseInt(formData.quantity),
        notes: formData.notes || undefined,
      });
      toast({ title: "Crédito registrado exitosamente" });
      setIsCreateOpen(false);
      setFormData({ customerName: "", productId: "", quantity: "", notes: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredit) return;

    try {
      await createPayment.mutateAsync({
        creditAccountId: selectedCredit.id,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod || undefined,
        notes: paymentData.notes || undefined,
      });
      toast({ title: "Pago registrado exitosamente" });
      setIsPaymentOpen(false);
      setSelectedCredit(null);
      setPaymentData({ amount: "", paymentMethod: "", notes: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openPaymentDialog = (credit: CreditAccountWithDetails) => {
    setSelectedCredit(credit);
    setIsPaymentOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      pending: "destructive",
      partial: "secondary",
      paid: "default",
    };
    const labels: Record<string, string> = {
      pending: "Pendiente",
      partial: "Parcial",
      paid: "Pagado",
    };
    return <Badge variant={variants[status]}>{labels[status] || status}</Badge>;
  };

  // Agrupar por cliente
  const creditsByCustomer = credits.reduce<Record<string, CreditAccountWithDetails[]>>(
    (acc, credit) => {
      const customerName = credit.customerName;
      if (!acc[customerName]) {
        acc[customerName] = [];
      }
      acc[customerName].push(credit);
      return acc;
    },
    {}
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto" aria-busy={isLoading}>
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Fiados</h1>
              <p className="text-muted-foreground">Gestiona las cuentas de crédito de tus clientes</p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Fiado
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Nuevo Fiado</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCredit} className="space-y-4">
                  <div>
                    <Label htmlFor="customerName">Nombre del Cliente</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="productId">Producto</Label>
                    <Select
                      value={formData.productId}
                      onValueChange={(value) => setFormData({ ...formData, productId: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} (Stock: {product.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createCredit.isPending}>
                {createCredit.isPending ? "Registrando..." : "Registrar Fiado"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalDebt.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingAccounts || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de créditos agrupada por cliente */}
      <div className="space-y-4">
        {Object.entries(creditsByCustomer).length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No hay cuentas de crédito registradas</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(creditsByCustomer).map(([customerName, customerCredits]) => {
            const totalDebt = customerCredits.reduce(
              (sum, c) => sum + parseFloat(c.remainingAmount),
              0
            );

            return (
              <Card key={customerName}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{customerName}</CardTitle>
                    <div className="text-lg font-semibold text-red-600">
                      Debe: ${totalDebt.toFixed(2)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pagado</TableHead>
                        <TableHead>Restante</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerCredits.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell>{credit.product?.name || "N/A"}</TableCell>
                          <TableCell>{credit.quantity}</TableCell>
                          <TableCell>${parseFloat(credit.totalAmount).toFixed(2)}</TableCell>
                          <TableCell>${parseFloat(credit.paidAmount).toFixed(2)}</TableCell>
                          <TableCell className="font-semibold text-red-600">
                            ${parseFloat(credit.remainingAmount).toFixed(2)}
                          </TableCell>
                          <TableCell>{getStatusBadge(credit.status)}</TableCell>
                          <TableCell>
                            {credit.createdAt ? new Date(credit.createdAt).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            {credit.status !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => openPaymentDialog(credit)}
                                variant="outline"
                              >
                                Registrar Pago
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          {selectedCredit && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Cliente:</strong> {selectedCredit.customerName}
                </p>
                <p className="text-sm">
                  <strong>Producto:</strong> {selectedCredit.product?.name}
                </p>
                <p className="text-sm">
                  <strong>Deuda Restante:</strong>{" "}
                  <span className="text-red-600 font-semibold">
                    ${parseFloat(selectedCredit.remainingAmount).toFixed(2)}
                  </span>
                </p>
              </div>
              <form onSubmit={handleCreatePayment} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Monto del Pago</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedCredit.remainingAmount}
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="paymentMethod">Método de Pago (Opcional)</Label>
                  <Input
                    id="paymentMethod"
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                    placeholder="Efectivo, Transferencia, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="paymentNotes">Notas (Opcional)</Label>
                  <Textarea
                    id="paymentNotes"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createPayment.isPending}>
                  {createPayment.isPending ? "Procesando..." : "Registrar Pago"}
                </Button>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  );
}
