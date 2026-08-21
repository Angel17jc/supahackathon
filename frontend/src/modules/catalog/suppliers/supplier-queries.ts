import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateSupplierRequest, type UpdateSupplierRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-errors";

const queryKey = [api.suppliers.list.path] as const;

export function useSuppliers() { return useQuery({ queryKey, queryFn: async () => {
  const response = await authenticatedFetch(api.suppliers.list.path);
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar los proveedores"));
  return api.suppliers.list.responses[200].parse(await response.json());
}}); }

function supplierMutation<T>(request: (data: T) => Promise<unknown>, successMessage: string) {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({ mutationFn: request, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: "Éxito", description: successMessage }); }, onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }) });
}

export function useCreateSupplier() { return supplierMutation(async (data: CreateSupplierRequest) => {
  const response = await authenticatedFetch(api.suppliers.create.path, { method: api.suppliers.create.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo crear el proveedor"));
  return api.suppliers.create.responses[201].parse(await response.json());
}, "Proveedor creado correctamente"); }

export function useUpdateSupplier() { return supplierMutation(async ({ id, ...data }: { id: number } & UpdateSupplierRequest) => {
  const response = await authenticatedFetch(buildUrl(api.suppliers.update.path, { id }), { method: api.suppliers.update.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo actualizar el proveedor"));
  return api.suppliers.update.responses[200].parse(await response.json());
}, "Proveedor actualizado correctamente"); }

export function useDeleteSupplier() { return supplierMutation(async (id: number) => {
  const response = await authenticatedFetch(buildUrl(api.suppliers.delete.path, { id }), { method: api.suppliers.delete.method });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo eliminar el proveedor"));
}, "Proveedor eliminado correctamente"); }
