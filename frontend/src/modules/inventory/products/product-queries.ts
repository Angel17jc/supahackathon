import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateProductRequest, type UpdateProductRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-errors";
import { authenticatedFetch } from "@/lib/auth";

const productsKey = [api.products.list.path] as const;
const dashboardKey = [api.stats.get.path] as const;

export function useProducts() { return useQuery({ queryKey: productsKey, queryFn: async () => { const response = await authenticatedFetch(api.products.list.path); if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar los productos")); return api.products.list.responses[200].parse(await response.json()); } }); }
export function useProduct(id: number) { return useQuery({ queryKey: [api.products.get.path, id], queryFn: async () => { const response = await authenticatedFetch(buildUrl(api.products.get.path, { id })); if (response.status === 404) return null; if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo cargar el producto")); return api.products.get.responses[200].parse(await response.json()); }, enabled: id > 0 }); }

function productMutation<T>(request: (data: T) => Promise<unknown>, successMessage: string) {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({ mutationFn: request, onSuccess: () => { queryClient.invalidateQueries({ queryKey: productsKey }); queryClient.invalidateQueries({ queryKey: dashboardKey }); toast({ title: "Éxito", description: successMessage }); }, onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }) });
}

export function useCreateProduct() { return productMutation(async (data: CreateProductRequest) => { const response = await authenticatedFetch(api.products.create.path, { method: api.products.create.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo crear el producto")); return api.products.create.responses[201].parse(await response.json()); }, "Producto creado correctamente"); }
export function useUpdateProduct() { return productMutation(async ({ id, ...data }: { id: number } & UpdateProductRequest) => { const response = await authenticatedFetch(buildUrl(api.products.update.path, { id }), { method: api.products.update.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo actualizar el producto")); return api.products.update.responses[200].parse(await response.json()); }, "Producto actualizado correctamente"); }
export function useDeleteProduct() { return productMutation(async (id: number) => { const response = await authenticatedFetch(buildUrl(api.products.delete.path, { id }), { method: api.products.delete.method }); if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo eliminar el producto")); }, "Producto eliminado correctamente"); }
