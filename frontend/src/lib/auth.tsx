import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { arrivedFromRecoveryLink, supabase } from "./supabase";

export type Role = "platform_admin" | "owner" | "manager" | "cashier";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  role?: "owner" | "manager" | "cashier";
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: Role | null;
  organizations: Organization[];
  activeOrganization: Organization | null;
  setActiveOrganization: (organizationId: string) => void;
  isOrganizationsLoading: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  completePasswordRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// A till is often left unattended mid-shift, so an idle session is signed out
// rather than left open for whoever sits down next.
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const IDLE_CHECK_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function getRole(user: User | null): Role | null {
  if (user?.app_metadata.platform_role === "platform_admin" || user?.app_metadata.role === "admin") return "platform_admin";
  // Organization membership, not a JWT claim, authorizes tenant users.
  return user ? "cashier" : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(sessionStorage.getItem("activeOrganizationId"));
  const [isLoading, setIsLoading] = useState(true);
  const [isOrganizationsLoading, setIsOrganizationsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(arrivedFromRecoveryLink);

  useEffect(() => {
    if (!session) {
      setOrganizations([]);
      setIsOrganizationsLoading(false);
      return;
    }
    setIsOrganizationsLoading(true);
    authenticatedFetch("/api/organizations/me")
      .then(async (response) => response.ok ? response.json() : [])
      .then((data: Organization[]) => {
        const activeOrganizations = data.filter((organization) => organization.status === "active");
        const nextOrganizationId = activeOrganizationId && activeOrganizations.some((organization) => organization.id === activeOrganizationId)
          ? activeOrganizationId
          : activeOrganizations[0]?.id ?? null;

        setOrganizations(activeOrganizations);
        setActiveOrganizationId(nextOrganizationId);

        if (nextOrganizationId) {
          sessionStorage.setItem("activeOrganizationId", nextOrganizationId);
        } else {
          sessionStorage.removeItem("activeOrganizationId");
        }
      })
      .finally(() => setIsOrganizationsLoading(false));
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    // Supabase reports the recovery link through this event. Relying on it
    // instead of the redirect URL matters because an unlisted redirect_to is
    // not rejected: Supabase silently falls back to the Site URL, and the
    // reset form would never open.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      setSession(nextSession);
      setIsLoading(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!session) return;

    // Activity only touches a ref, so no render happens on every keystroke; a
    // single interval decides when the session has gone stale.
    lastActivityRef.current = Date.now();
    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current < IDLE_LIMIT_MS) return;
      sessionStorage.removeItem("activeOrganizationId");
      void supabase.auth.signOut();
    }, IDLE_CHECK_MS);

    return () => {
      window.clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
    };
  }, [session]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    role: getRole(session?.user ?? null),
    organizations,
    activeOrganization: organizations.find((organization) => organization.id === activeOrganizationId) ?? null,
    setActiveOrganization: (organizationId: string) => {
      sessionStorage.setItem("activeOrganizationId", organizationId);
      setActiveOrganizationId(organizationId);
      window.location.assign("/panel");
    },
    isOrganizationsLoading,
    isLoading,
    isPasswordRecovery,
    completePasswordRecovery: () => setIsPasswordRecovery(false),
    signOut: async () => {
      sessionStorage.removeItem("activeOrganizationId");
      await supabase.auth.signOut();
    },
  }), [session, organizations, activeOrganizationId, isLoading, isOrganizationsLoading, isPasswordRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const organizationId = sessionStorage.getItem("activeOrganizationId");
  if (organizationId) headers.set("X-Organization-Id", organizationId);
  return fetch(input, { ...init, headers });
}
