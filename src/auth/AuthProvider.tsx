import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import AuthScreen from "./AuthScreen";

type AuthContextValue = {
  user: User;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () =>
      user
        ? {
            user,
            signOut: async () => {
              await supabase.auth.signOut();
            },
          }
        : null,
    [user],
  );

  if (loading) {
    return (
      <main className="auth-loading">
        <span className="auth-brand-mark"><span /><i /></span>
        <strong>CricApp</strong>
        <span className="loading-dots"><i /><i /><i /></span>
      </main>
    );
  }

  if (recovering && user) {
    return <AuthScreen initialMode="reset" onRecoveryComplete={() => setRecovering(false)} />;
  }

  if (!user || !value) return <AuthScreen />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
