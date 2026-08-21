import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { createCategoryRequestSchema } from "@shared/schema";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "./category-queries";

type CategoryFormValues = z.infer<typeof createCategoryRequestSchema>;
type EditableCategory = CategoryFormValues & { id: number };

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EditableCategory | null>(null);
  const form = useForm<CategoryFormValues>({ resolver: zodResolver(createCategoryRequestSchema), defaultValues: { name: "", description: "" } });

  function closeModal() {
    setIsModalOpen(false);
    setEditingCategory(null);
    form.reset();
  }

  function openNewCategory() {
    setEditingCategory(null);
    form.reset({ name: "", description: "" });
    setIsModalOpen(true);
  }

  function editCategory(category: EditableCategory) {
    setEditingCategory(category);
    form.reset({ name: category.name, description: category.description ?? "" });
    setIsModalOpen(true);
  }

  function submitCategory(data: CategoryFormValues) {
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, ...data }, { onSuccess: closeModal });
      return;
    }
    createCategory.mutate(data, { onSuccess: closeModal });
  }

  const isSaving = createCategory.isPending || updateCategory.isPending;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl space-y-8 p-8">
          <header className="flex items-center justify-between">
            <div><h1 className="mb-2 text-3xl font-bold font-display text-foreground">Categorías</h1><p className="text-muted-foreground">Organiza tus productos.</p></div>
            <Button onClick={openNewCategory} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nueva Categoría</Button>
          </header>

          <div className="glass-panel rounded-2xl p-6">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div> : (
              <Table><TableHeader><TableRow className="border-border/50 hover:bg-transparent"><TableHead className="text-foreground">Nombre</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{categories?.map((category) => <TableRow key={category.id} className="border-border/30 hover:bg-primary/5"><TableCell className="font-medium"><div className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /><span className="text-foreground">{category.name}</span></div></TableCell><TableCell className="text-muted-foreground">{category.description || "-"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => editCategory(category)}><Edit2 className="h-4 w-4 text-blue-400" /></Button><Button variant="ghost" size="icon" onClick={() => deleteCategory.mutate(category.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></div></TableCell></TableRow>)}</TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={(open) => open ? setIsModalOpen(true) : closeModal()}>
        <DialogContent className="border-border bg-card"><DialogHeader><DialogTitle className="text-foreground">{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(submitCategory)} className="space-y-4"><FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Ej. Whiskys" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Descripción</FormLabel><FormControl><Input placeholder="Opcional..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>} /><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button><Button type="submit" className="bg-primary text-primary-foreground" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></div></form></Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
