import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CreateMovementRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-errors";
import { authenticatedFetch } from "@/lib/auth";

export function useMovements() {
  return useQuery({ queryKey: [api.movements.list.path], queryFn: async () => {
    const response = await authenticatedFetch(api.movements.list.path);
    if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar los movimientos"));
    return api.movements.list.responses[200].parse(await response.json());
  }});
}

export function useCreateMovement() {
  const queryClient = useQueryClient(); const { toast } = useToast();
  return useMutation({ mutationFn: async (data: CreateMovementRequest) => {
    const response = await authenticatedFetch(api.movements.create.path, { method: api.movements.create.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo registrar el movimiento"));
    return api.movements.create.responses[201].parse(await response.json());
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: [api.movements.list.path] }); queryClient.invalidateQueries({ queryKey: [api.products.list.path] }); queryClient.invalidateQueries({ queryKey: [api.stats.get.path] }); toast({ title: "Éxito", description: "Movimiento registrado correctamente" }); }, onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }) });
}

export function useStats() {
  return useQuery({ queryKey: [api.stats.get.path], queryFn: async () => {
    const response = await authenticatedFetch(api.stats.get.path);
    if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar las estadísticas"));
    return api.stats.get.responses[200].parse(await response.json());
  }});
}
