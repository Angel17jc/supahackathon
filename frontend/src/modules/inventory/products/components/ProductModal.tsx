import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { insertProductSchema } from "@shared/schema";
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { Loader2 } from "lucide-react";
import { ProductImageUpload } from "./ProductImageUpload";
import { useEffect } from "react";

// Extend schema for form validation to handle string inputs for numbers
const formSchema = insertProductSchema.extend({
  quantity: z.coerce.number().min(0),
  isPublished: z.boolean().optional(),
  minStockLevel: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  categoryId: z.coerce.number().optional(),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any; // If provided, edit mode
}

export function ProductModal({ open, onOpenChange, product }: ProductModalProps) {
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isEditing = !!product;
  const isPending = createProduct.isPending || updateProduct.isPending;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      quantity: 0,
      minStockLevel: 5,
      costPrice: 0,
      sellingPrice: 0,
      imageUrl: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku || "",
        description: product.description || "",
        quantity: product.quantity,
        minStockLevel: product.minStockLevel || 5,
        costPrice: Number(product.costPrice),
        sellingPrice: Number(product.sellingPrice),
        imageUrl: product.imageUrl || "",
        categoryId: product.categoryId,
      });
    } else {
      form.reset({
        name: "",
        sku: "",
        description: "",
        quantity: 0,
        minStockLevel: 5,
        costPrice: 0,
        sellingPrice: 0,
        imageUrl: "",
      });
    }
  }, [product, form]);

  function onSubmit(data: ProductFormValues) {
    // Convert numeric decimal values to strings as expected by schema
    const submitData = {
      ...data,
      costPrice: String(data.costPrice),
      sellingPrice: String(data.sellingPrice),
    };

    if (isEditing) {
      updateProduct.mutate({ id: product.id, ...submitData }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createProduct.mutate(submitData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            {isEditing ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Producto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Whisky Black Label" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Código)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. WBL-750" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vitrina</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "si")} value={field.value ? "si" : "no"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="si">Publicado</SelectItem>
                        <SelectItem value="no">Borrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Portada</FormLabel>
                    <FormControl>
                      <ProductImageUpload value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Costo</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Venta</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Actual</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled={isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Mínimo</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Detalles opcionales..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Guardar Cambios" : "Crear Producto"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
