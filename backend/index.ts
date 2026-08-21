import "dotenv/config";
import { createServer } from "http";
import { createApp, log } from "./app.js";
import { serveStatic } from "./static.js";

(async () => {
  const httpServer = createServer();
  const app = await createApp(httpServer);
  httpServer.on("request", app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, () => {
    log(`serving on port ${port}`);
    log(`http://localhost:${port}`);
  });
})();
