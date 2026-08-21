import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateCategoryRequest, type UpdateCategoryRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-errors";

const queryKey = [api.categories.list.path] as const;
const notify = (title: string, description: string, toast: ReturnType<typeof useToast>["toast"]) => toast({ title, description, variant: title === "Error" ? "destructive" : undefined });

export function useCategories() {
  return useQuery({ queryKey, queryFn: async () => {
    const response = await authenticatedFetch(api.categories.list.path);
    if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar las categorías"));
    return api.categories.list.responses[200].parse(await response.json());
  }});
}

function categoryMutation<T>(request: (data: T) => Promise<unknown>, successMessage: string) {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({ mutationFn: request, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); notify("Éxito", successMessage, toast); }, onError: (error) => notify("Error", error.message, toast) });
}

export function useCreateCategory() { return categoryMutation(async (data: CreateCategoryRequest) => {
  const response = await authenticatedFetch(api.categories.create.path, { method: api.categories.create.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo crear la categoría"));
  return api.categories.create.responses[201].parse(await response.json());
}, "Categoría creada correctamente"); }

export function useUpdateCategory() { return categoryMutation(async ({ id, ...data }: { id: number } & UpdateCategoryRequest) => {
  const response = await authenticatedFetch(buildUrl(api.categories.update.path, { id }), { method: api.categories.update.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo actualizar la categoría"));
  return api.categories.update.responses[200].parse(await response.json());
}, "Categoría actualizada correctamente"); }

export function useDeleteCategory() { return categoryMutation(async (id: number) => {
  const response = await authenticatedFetch(buildUrl(api.categories.delete.path, { id }), { method: api.categories.delete.method });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo eliminar la categoría"));
}, "Categoría eliminada correctamente"); }
