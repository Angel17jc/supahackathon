import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured");
}

// Read while the module loads, which is before the router mounts. Recovery
// links carry their tokens in the URL fragment, and both wouter's history
// navigation and supabase-js itself erase it: the first drops the fragment when
// it replaces the path, the second clears it once the tokens are consumed. By
// the time a component renders, the evidence can already be gone.
function cameFromRecoveryLink() {
  const { hash, search } = window.location;
  return hash.includes("type=recovery") || search.includes("type=recovery") || search.includes("reset=1");
}

export const arrivedFromRecoveryLink = cameFromRecoveryLink();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // The till is a shared machine: the session must not outlive the tab, so it
    // is held in sessionStorage rather than the default localStorage. Each tab
    // therefore signs in on its own, which is the intended trade-off.
    storage: window.sessionStorage,
  },
});
