import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { createSupplierRequestSchema } from "@shared/schema";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateSupplier, useDeleteSupplier, useSuppliers, useUpdateSupplier } from "./supplier-queries";

type SupplierFormValues = z.infer<typeof createSupplierRequestSchema>;
type EditableSupplier = SupplierFormValues & { id: number };

export default function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier(); const updateSupplier = useUpdateSupplier(); const deleteSupplier = useDeleteSupplier();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<EditableSupplier | null>(null);
  const form = useForm<SupplierFormValues>({ resolver: zodResolver(createSupplierRequestSchema), defaultValues: { name: "", contactInfo: "", address: "" } });

  function closeModal() { setIsModalOpen(false); setEditingSupplier(null); form.reset(); }
  function openNewSupplier() { setEditingSupplier(null); form.reset({ name: "", contactInfo: "", address: "" }); setIsModalOpen(true); }
  function editSupplier(supplier: EditableSupplier) { setEditingSupplier(supplier); form.reset({ name: supplier.name, contactInfo: supplier.contactInfo ?? "", address: supplier.address ?? "" }); setIsModalOpen(true); }
  function submitSupplier(data: SupplierFormValues) {
    if (editingSupplier) { updateSupplier.mutate({ id: editingSupplier.id, ...data }, { onSuccess: closeModal }); return; }
    createSupplier.mutate(data, { onSuccess: closeModal });
  }

  const isSaving = createSupplier.isPending || updateSupplier.isPending;
  return <div className="flex h-screen bg-background text-foreground"><Sidebar /><main className="flex-1 overflow-auto"><div className="mx-auto max-w-5xl space-y-8 p-8">
    <header className="flex items-center justify-between"><div><h1 className="mb-2 text-3xl font-bold font-display text-white">Proveedores</h1><p className="text-muted-foreground">Gestiona tus distribuidores.</p></div><Button onClick={openNewSupplier} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nuevo Proveedor</Button></header>
    <div className="glass-panel rounded-2xl p-6">{isLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div> : <Table><TableHeader><TableRow className="border-border/50 hover:bg-transparent"><TableHead className="text-white">Nombre</TableHead><TableHead>Contacto</TableHead><TableHead>Dirección</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{suppliers?.map((supplier) => <TableRow key={supplier.id} className="border-border/30 hover:bg-white/5"><TableCell className="font-medium"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><span className="text-white">{supplier.name}</span></div></TableCell><TableCell className="text-muted-foreground">{supplier.contactInfo || "-"}</TableCell><TableCell className="text-muted-foreground">{supplier.address || "-"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => editSupplier(supplier)}><Edit2 className="h-4 w-4 text-blue-400" /></Button><Button variant="ghost" size="icon" onClick={() => deleteSupplier.mutate(supplier.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></div></TableCell></TableRow>)}</TableBody></Table>}</div>
  </div></main><Dialog open={isModalOpen} onOpenChange={(open) => open ? setIsModalOpen(true) : closeModal()}><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="text-white">{editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(submitSupplier)} className="space-y-4"><FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Ej. Distribuidora Central" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="contactInfo" render={({ field }) => <FormItem><FormLabel>Información de contacto</FormLabel><FormControl><Input placeholder="Teléfono, correo..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="address" render={({ field }) => <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input placeholder="Calle 123..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>} /><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button><Button type="submit" className="bg-primary text-primary-foreground" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></div></form></Form></DialogContent></Dialog></div>;
}
