import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { createCreditAccountRequestSchema, createCreditPaymentRequestSchema } from "../../../shared/schema.js";
import { sendApiError } from "../../errors.js";
import { DatabaseStorage } from "../../storage.js";

type ScopedStorage = (request: Request) => DatabaseStorage;
interface CreditRouteDependencies { requireOperator: RequestHandler; scopedStorage: ScopedStorage; }

export function registerCreditRoutes(app: Express, { requireOperator, scopedStorage }: CreditRouteDependencies) {
  app.get("/api/credits", async (req, res) => res.json(await scopedStorage(req).getCreditAccounts()));
  app.get("/api/credits/customer/:customerName", async (req, res) => res.json(await scopedStorage(req).getCreditAccountsByCustomer(req.params.customerName)));
  app.get("/api/credits/stats", async (req, res) => res.json(await scopedStorage(req).getCreditsStats()));
  app.post("/api/credits", requireOperator, async (req, res) => { try { return res.status(201).json(await scopedStorage(req).createCreditAccount(createCreditAccountRequestSchema.parse(req.body))); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message }); return sendApiError(res, error); } });
  app.post("/api/credits/payment", requireOperator, async (req, res) => { try { return res.status(201).json(await scopedStorage(req).createCreditPayment(createCreditPaymentRequestSchema.parse(req.body))); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message }); return sendApiError(res, error); } });
}
