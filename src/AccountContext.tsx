import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { type Session } from "@supabase/supabase-js";
import { cachedAccountIdentity, cleanSignInUrl, getAuthClient } from "./auth";
import { cloneElement } from "react";

type Identity = { id: string; email?: string };
type Account = {
  user: Identity | null;
  available: boolean;
  switching: boolean;
  blocked: boolean;
  setBlocked: (value: boolean) => void;
  error: string;
  clearError: () => void;
};
const AccountContext = createContext<Account | null>(null);
export function useAccount() {
  return useContext(AccountContext);
}

export function AccountWorkspace({ children }: { children: ReactElement }) {
  const [auth] = useState(getAuthClient);
  const [loading, setLoading] = useState(!!auth && navigator.onLine !== false);
  const [identity, setIdentity] = useState<Identity | null>(() =>
    navigator.onLine === false ? cachedAccountIdentity() : null,
  );
  const [workspace, setWorkspace] = useState<Identity | null>(() =>
    navigator.onLine === false ? cachedAccountIdentity() : null,
  );
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef<Session | null | undefined>(undefined);
  const [linkError] = useState(
    () =>
      new URL(location.href).searchParams.has("error") ||
      /^#error=/.test(location.hash),
  );
  useEffect(() => {
    if (!auth) return;
    let alive = true;
    const subscription = auth.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      latest.current = next;
      setIdentity(
        next?.user ??
          (_event === "INITIAL_SESSION" && navigator.onLine === false
            ? cachedAccountIdentity()
            : null),
      );
    }).data.subscription;
    void auth.auth
      .getSession()
      .then(({ data, error: problem }) => {
        if (!alive) return;
        const next =
          latest.current === undefined ? data.session : latest.current;
        latest.current = next;
        const restored =
          next?.user ??
          (problem &&
          (navigator.onLine === false ||
            problem.name === "AuthRetryableFetchError")
            ? cachedAccountIdentity()
            : null);
        setIdentity(restored);
        setWorkspace(restored);
        if ((problem && !restored) || linkError)
          setError(
            "That sign-in link could not be opened. Request a new link or continue as a guest.",
          );
        cleanSignInUrl();
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        const restored =
          navigator.onLine === false ? cachedAccountIdentity() : null;
        setIdentity(restored);
        setWorkspace(restored);
        setError(
          restored
            ? "You’re offline. Account workouts saved on this device are still available."
            : "Sign-in is unavailable. You can continue as a guest.",
        );
        cleanSignInUrl();
        setLoading(false);
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [auth]);
  const switching = (identity?.id ?? null) !== (workspace?.id ?? null);
  useEffect(() => {
    if (!loading && !blocked && switching) setWorkspace(identity);
  }, [loading, blocked, switching, identity]);
  if (loading)
    return (
      <main className="main account-loading">
        <p role="status">Opening your planner…</p>
      </main>
    );
  return (
    <AccountContext.Provider
      value={{
        user: workspace,
        available: !!auth,
        switching,
        blocked,
        setBlocked,
        error,
        clearError: () => setError(""),
      }}
    >
      {error && (
        <aside className="notice no-print" role="status">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss sign-in message</button>
        </aside>
      )}
      {switching && blocked && (
        <aside className="notice no-print" role="status">
          Your sign-in changed in another tab. Finish or export your open edits
          to switch accounts. Cloud saving is paused.
        </aside>
      )}
      {cloneElement(children, { key: workspace?.id ?? "guest" })}
    </AccountContext.Provider>
  );
}
