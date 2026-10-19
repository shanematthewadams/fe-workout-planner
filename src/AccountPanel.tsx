import { useEffect, useState } from "react";
import {
  LogIn,
  LogOut,
  Mail,
  ArrowRight,
  UserRound,
  FolderInput,
} from "lucide-react";
import { getAuthClient, signInRedirect } from "./auth";
import { useAccount } from "./AccountContext";
import { readState } from "./model";

export function AccountPanel({
  onImportGuest,
}: {
  onImportGuest: () => boolean;
}) {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [imported, setImported] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  if (!account?.available) return null;
  let guestCount = 0;
  try {
    guestCount = readState().workouts.length;
  } catch {
    /* Existing guest recovery remains available after signing out. */
  }
  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const client = getAuthClient();
    if (!client || busy || cooldown || account?.blocked) return;
    setBusy(true);
    setMessage("");
    account?.clearError();
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: signInRedirect(), shouldCreateUser: true },
      });
      if (error) {
        if (error.status === 429) {
          setCooldown(60);
          throw Error(
            "Please wait a minute before requesting another sign-in link.",
          );
        }
        if (error.code === "email_address_not_authorized")
          throw Error(
            "Sign-in emails aren’t ready for this address yet. You can keep using the app as a guest.",
          );
        throw Error(
          "We couldn’t send your sign-in link. Try again shortly; guest access still works.",
        );
      }
      setSent(true);
      setCooldown(60);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign-in is unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-panel" aria-label="Your account">
      <h2 id="account-heading" tabIndex={-1}>
        <UserRound size={25} aria-hidden="true" />{" "}
        {account.user ? "Your account" : "Keep your workouts"}
      </h2>
      {account.user ? (
        <>
          <p>
            Signed in as{" "}
            <strong className="account-email">
              {account.user.email ?? "your account"}
            </strong>
            .
          </p>
          <p>
            Your saved workouts follow you when you sign in on another phone or
            computer. Offline changes upload when you reconnect.
          </p>
          {guestCount > 0 && !imported && (
            <div className="guest-import">
              <p>
                This browser also has {guestCount} guest{" "}
                {guestCount === 1 ? "workout" : "workouts"}. Add them to this
                account when you’re ready.
              </p>
              <button
                disabled={account.blocked || busy || account.switching}
                onClick={() => {
                  if (onImportGuest()) {
                    setImported(true);
                    setMessage(
                      "Guest workouts added. The original guest copies are still available after signing out.",
                    );
                  }
                }}
              >
                <FolderInput size={18} aria-hidden="true" /> Add guest workouts
                to my account
              </button>
            </div>
          )}
          <button
            disabled={busy || account.blocked || account.switching}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                const result = await getAuthClient()?.auth.signOut({
                  scope: "local",
                });
                if (result?.error) throw result.error;
              } catch {
                setMessage("Couldn’t sign out. Try again when connected.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </>
      ) : (
        <>
          <p>
            Sign in to keep a personal workout library you can open on any
            device. No password. Guest access stays open.
          </p>
          <form onSubmit={sendLink} className="account-form">
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSent(false);
                }}
              />
            </label>
            <button
              type="submit"
              disabled={busy || cooldown > 0 || account.blocked}
            >
              <Mail size={18} aria-hidden="true" />{" "}
              {busy
                ? "Sending…"
                : cooldown > 0
                  ? `Send again in ${cooldown}s`
                  : sent
                    ? "Send another sign-in link"
                    : "Email me a sign-in link"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>
          {sent && (
            <p role="status">
              Check your email. Open the sign-in link in this same browser to
              finish signing in.
            </p>
          )}
        </>
      )}
      {account.blocked && (
        <p>Finish or export your open edits before changing accounts.</p>
      )}
      {(message || account.error) && (
        <p role="status">{message || account.error}</p>
      )}
    </section>
  );
}
export function AccountEntry({ onOpen }: { onOpen: () => void }) {
  const account = useAccount();
  if (!account?.available) return null;
  return (
    <button className="account-entry" onClick={onOpen}>
      {account.user ? (
        <UserRound size={18} aria-hidden="true" />
      ) : (
        <LogIn size={18} aria-hidden="true" />
      )}
      {account.user ? "My account" : "Sign in"}
    </button>
  );
}
