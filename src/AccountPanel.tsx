import { useEffect, useRef, useState } from "react";
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
import { ProfileEditor } from "./ProfileContext";
import { readState } from "./model";

export function AccountPanel({
  onImportGuest,
}: {
  onImportGuest: () => boolean;
}) {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyWait, setVerifyWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const refocusCode = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const sent = !!sentEmail;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [imported, setImported] = useState(false);
  useEffect(() => {
    if (!cooldown && !verifyWait) return;
    const timer = setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
      setVerifyWait((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown, verifyWait]);
  useEffect(() => {
    if (sentEmail && !busy && refocusCode.current) {
      codeInput.current?.focus();
      codeInput.current?.select();
      refocusCode.current = false;
    } else if (!sentEmail) emailInput.current?.focus();
  }, [sentEmail, busy]);
  if (!account?.available) return null;
  let guestCount = 0;
  try {
    guestCount = readState().workouts.length;
  } catch {
    /* Existing guest recovery remains available after signing out. */
  }
  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    const client = getAuthClient();
    const requested = sentEmail || email.trim();
    if (!client || !requested || busy || cooldown || account?.blocked) return;
    setBusy(true);
    setMessage("");
    account?.clearError();
    try {
      const { error } = await client.auth.signInWithOtp({
        email: requested,
        // Retain same-origin returns for any older link templates during setup.
        options: { emailRedirectTo: signInRedirect(), shouldCreateUser: true },
      });
      if (error) {
        if (error.status === 429) {
          setCooldown(60);
          throw Error(
            "Please wait a minute before requesting another sign-in code.",
          );
        }
        if (error.code === "email_address_not_authorized")
          throw Error(
            "Sign-in emails aren’t ready for this address yet. You can keep using the app as a guest.",
          );
        throw Error(
          "We couldn’t send your sign-in code. Try again shortly; guest access still works.",
        );
      }
      refocusCode.current = true;
      setSentEmail(requested);
      setCode("");
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
  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const client = getAuthClient();
    if (
      !client ||
      !sentEmail ||
      busy ||
      verifyWait ||
      account?.blocked ||
      !/^[0-9]{6,10}$/.test(code)
    )
      return;
    setBusy(true);
    setVerifying(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.verifyOtp({
        email: sentEmail,
        token: code,
        type: "email",
      });
      if (error) {
        if (error.status === 429) {
          setVerifyWait(60);
          throw Error(
            "Too many attempts. Wait a minute before trying your code again.",
          );
        }
        if (
          error.code === "otp_expired" ||
          [400, 401, 403].includes(error.status ?? 0)
        )
          throw Error(
            "That code is incorrect or has expired. Check the newest email or request a new code.",
          );
        throw Error(
          "We couldn’t verify your code. Check your connection and try again.",
        );
      }
      if (!data.session)
        throw Error(
          "We couldn’t finish signing in. Please request a new code.",
        );
      setCode("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Couldn’t verify your code. Please try again.",
      );
      refocusCode.current = true;
    } finally {
      setBusy(false);
      setVerifying(false);
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
          <ProfileEditor />
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
          {!sent ? (
            <form onSubmit={sendCode} className="account-form">
              <label>
                Email address
                <input
                  ref={emailInput}
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={busy || cooldown > 0 || account.blocked}
              >
                <Mail size={18} aria-hidden="true" />
                {busy
                  ? "Sending…"
                  : cooldown > 0
                    ? `Send again in ${cooldown}s`
                    : "Email me a sign-in code"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <>
              <p role="status">
                Check your email at{" "}
                <strong className="account-email">{sentEmail}</strong>.
              </p>
              <p>
                First time here? Open the confirmation link in that email.
                Returning? Enter your sign-in code below.
              </p>
              <form onSubmit={verifyCode} className="account-form">
                <label>
                  Sign-in code
                  <input
                    ref={codeInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-describedby={message ? "account-message" : undefined}
                    aria-invalid={message.startsWith("That code") || undefined}
                    enterKeyHint="done"
                    pattern="[0-9]{6,10}"
                    minLength={6}
                    maxLength={32}
                    required
                    value={code}
                    placeholder="Enter your email code"
                    disabled={busy || account.blocked || verifyWait > 0}
                    onChange={(event) => {
                      setCode(
                        event.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                      );
                      setMessage("");
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    busy || account.blocked || code.length < 6 || verifyWait > 0
                  }
                >
                  {verifying
                    ? "Signing in…"
                    : verifyWait > 0
                      ? `Try again in ${verifyWait}s`
                      : "Verify & sign in"}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
              <div className="actions account-code-actions">
                <button
                  type="button"
                  disabled={busy || cooldown > 0 || account.blocked}
                  onClick={() => void sendCode()}
                >
                  {cooldown > 0
                    ? `Send again in ${cooldown}s`
                    : "Send a new code"}
                </button>
                <button
                  type="button"
                  disabled={busy || account.blocked}
                  onClick={() => {
                    setSentEmail("");
                    setCode("");
                    setMessage("");
                  }}
                >
                  Use a different email
                </button>
              </div>
            </>
          )}
        </>
      )}
      {account.blocked && (
        <p>Finish or export your open edits before changing accounts.</p>
      )}
      {(message || account.error) && (
        <p id="account-message" role="status">
          {message || account.error}
        </p>
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
