import type { Response } from "express";
import { z } from "zod";

type DatabaseError = { code?: string; status?: number; statusCode?: number; message?: string };

export function getApiError(error: unknown): { status: number; message: string } {
  if (error instanceof z.ZodError) return { status: 400, message: error.errors[0]?.message ?? "Invalid request" };
  const databaseError = error as DatabaseError;
  if (databaseError.code === "23505") return { status: 409, message: "A record with these values already exists" };
  if (databaseError.code === "23503") return { status: 409, message: "The operation conflicts with related records" };
  if (databaseError.code === "P0002") return { status: 404, message: "The requested record was not found" };
  if (databaseError.code === "22000" || databaseError.code === "22023") return { status: 400, message: databaseError.message ?? "Invalid operation" };
  return { status: databaseError.status ?? databaseError.statusCode ?? 500, message: "An unexpected error occurred" };
}

export function sendApiError(response: Response, error: unknown) {
  const { status, message } = getApiError(error);
  return response.status(status).json({ message });
}
