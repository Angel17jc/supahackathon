import express, { type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { registerRoutes } from "./routes.js";
import { getApiError } from "./errors.js";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Shared by the standalone server (backend/index.ts) and the Vercel serverless
// entry point (api/index.ts) so both expose exactly the same API surface.
export async function createApp(httpServer: Server) {
  const app = express();

  // Express advertises itself by default, which only helps someone matching
  // known vulnerabilities to the stack.
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    // API responses are private to the caller and must not be cached anywhere.
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  // Only the request line is logged. Response bodies used to be written here,
  // which sent customer names, balances and stock figures to the platform's log
  // storage on every call.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
      }
    });
    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    const { status, message } = getApiError(err);
    return res.status(status).json({ message });
  });

  return app;
}
