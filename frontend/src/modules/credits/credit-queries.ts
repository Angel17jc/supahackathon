import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreditAccountWithDetails, CreditsStats, CreateCreditAccountRequest, CreateCreditPaymentRequest } from "@shared/schema";
import { authenticatedFetch } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-errors";

async function fetchCredits(): Promise<CreditAccountWithDetails[]> {
  const response = await authenticatedFetch("/api/credits");
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar los fiados."));
  return response.json();
}

async function fetchCreditsByCustomer(customerName: string): Promise<CreditAccountWithDetails[]> {
  const response = await authenticatedFetch(`/api/credits/customer/${encodeURIComponent(customerName)}`);
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar los fiados del cliente."));
  return response.json();
}

async function fetchCreditsStats(): Promise<CreditsStats> {
  const response = await authenticatedFetch("/api/credits/stats");
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudieron cargar las estadísticas de fiados."));
  return response.json();
}

async function createCredit(credit: CreateCreditAccountRequest) {
  const response = await authenticatedFetch("/api/credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credit),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo registrar el fiado."));
  return response.json();
}

async function createPayment(payment: CreateCreditPaymentRequest) {
  const response = await authenticatedFetch("/api/credits/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payment),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No se pudo registrar el pago."));
  return response.json();
}

export function useCredits() {
  return useQuery<CreditAccountWithDetails[]>({
    queryKey: ["credits"],
    queryFn: fetchCredits,
  });
}

export function useCreditsByCustomer(customerName: string) {
  return useQuery<CreditAccountWithDetails[]>({
    queryKey: ["credits", "customer", customerName],
    queryFn: () => fetchCreditsByCustomer(customerName),
    enabled: !!customerName,
  });
}

export function useCreditsStats() {
  return useQuery<CreditsStats>({
    queryKey: ["credits", "stats"],
    queryFn: fetchCreditsStats,
  });
}

export function useCreateCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}
