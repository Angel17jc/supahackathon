import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite inlines every VITE_* variable into the browser bundle. A service role
// key placed there ships full, RLS-bypassing database access to every visitor,
// so the build fails instead of publishing one.
function assertPublicSupabaseKey(): Plugin {
  return {
    name: "assert-public-supabase-key",
    configResolved(config) {
      const key = config.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!key) return;

      const fail = (reason: string) => {
        throw new Error(
          `VITE_SUPABASE_ANON_KEY ${reason}. It is inlined into the client bundle ` +
            `and readable by anyone who opens the app. Use the project's anon / ` +
            `publishable key, never the service role key.`,
        );
      };

      if (key.startsWith("sb_secret_")) fail("is a secret key");
      if (!key.startsWith("eyJ")) return;

      try {
        const payload = JSON.parse(
          Buffer.from(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
        );
        if (payload.role && payload.role !== "anon") fail(`carries role "${payload.role}"`);
      } catch (error) {
        if (error instanceof Error && error.message.includes("VITE_SUPABASE_ANON_KEY")) throw error;
      }
    },
  };
}

export default defineConfig({
  // Keep browser-safe VITE_* variables in the project root alongside the
  // server variables used by Express.
  envDir: import.meta.dirname,
  plugins: [react(), assertPublicSupabaseKey()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "frontend", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "frontend"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
