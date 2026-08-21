import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

// The backend is imported lazily. backend/db.ts validates its configuration at
// module scope, and a throw there aborts the invocation before any handler code
// runs, leaving only an opaque FUNCTION_INVOCATION_FAILED. Importing inside the
// promise brings that window inside the catch, so the cause reaches the logs.
let bootstrap: Promise<RequestHandler | null> | undefined;

function start(): Promise<RequestHandler | null> {
  return import("../backend/app.js")
    .then(({ createApp }) => createApp(createServer()))
    .then((app) => app as unknown as RequestHandler)
    .catch((error: unknown) => {
      console.error("API initialisation failed:", error);
      return null;
    });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  bootstrap ??= start();
  const app = await bootstrap;

  if (!app) {
    // Details stay in the runtime logs: naming the missing variable or the
    // unresolved module would describe the server's internals to anyone asking.
    bootstrap = undefined;
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ message: "Service temporarily unavailable" }));
    return;
  }

  app(req, res);
}
