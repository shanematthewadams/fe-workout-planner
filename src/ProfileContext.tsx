import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { requestProfile, type Profile, type ProfileFields } from "./profile";
import { useAccount } from "./AccountContext";
import { aoProfiles } from "./discovery";
const Context = createContext<{
  profile: Profile | null;
  ready: boolean;
  error: string;
  save: (fields: ProfileFields) => Promise<void>;
  retry: () => void;
} | null>(null);
export const useProfile = () => useContext(Context);
export function ProfileWorkspace({ children }: { children: ReactNode }) {
  const account = useAccount();
  const owner = account?.user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const signupName = account?.user?.user_metadata?.f3_name;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    void requestProfile(owner)
      .then(async (value) => {
        if (!live) return;
        if (
          !value &&
          typeof signupName === "string" &&
          signupName.trim() &&
          signupName.trim().length <= 80
        ) {
          value = await requestProfile(
            owner,
            {
              display_name: signupName.trim(),
              home_region: "The FE",
              home_ao: "",
            },
            true,
          );
          if (!value)
            throw Error("Couldn’t finish your profile. Retry when connected.");
        }
        if (live) {
          setProfile(value);
          setReady(true);
          setError("");
        }
      })
      .catch((problem) => {
        if (live) setError(problem.message);
      });
    return () => {
      live = false;
    };
  }, [owner, attempt, signupName]);
  return (
    <Context.Provider
      value={{
        profile,
        ready,
        error,
        retry: () => setAttempt((v) => v + 1),
        save: async (fields) => {
          if (!owner || account?.switching)
            throw Error("Wait for your account to finish opening.");
          const next = await requestProfile(owner, fields);
          setProfile(next);
          setReady(true);
          setError("");
        },
      }}
    >
      {owner && ready && !profile && (
        <aside className="profile-onboarding no-print">
          <FirstProfile />
        </aside>
      )}
      {children}
    </Context.Provider>
  );
}
export function ProfileEditor() {
  const context = useProfile();
  const account = useAccount();
  if (!context || !account?.user) return null;
  if (!context.ready)
    return (
      <div role="status">
        {context.error ? (
          <>
            {context.error}{" "}
            <button type="button" onClick={context.retry}>
              Retry profile
            </button>
          </>
        ) : (
          "Opening your F3 profile…"
        )}
      </div>
    );
  return context.profile ? <ProfileEditorContent /> : null;
}
function FirstProfile() {
  const context = useProfile()!;
  const account = useAccount()!;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="account-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || account.blocked || account.switching) return;
        setBusy(true);
        try {
          await context.save({
            display_name: name,
            home_region: "The FE",
            home_ao: "",
          });
        } catch (problem) {
          setMessage(
            problem instanceof Error
              ? problem.message
              : "Couldn’t save your F3 Name.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>What’s your F3 Name?</h3>
      <p>
        Your account is open. Add your F3 Name to finish your profile. You can
        keep browsing below.
      </p>
      <label>
        F3 Name
        <input
          required
          maxLength={80}
          autoComplete="nickname"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button disabled={busy || account.blocked || account.switching}>
        {busy ? "Saving…" : "Save F3 Name"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
function ProfileEditorContent() {
  const context = useProfile()!;
  const [message, setMessage] = useState("");
  return (
    <>
      <ProfileForm
        key={context.profile?.updated_at ?? "new"}
        onSaved={() => setMessage("Profile saved.")}
        onEditing={() => setMessage("")}
      />
      {message && <p role="status">{message}</p>}
    </>
  );
}
function ProfileForm({
  onSaved,
  onEditing,
}: {
  onSaved: () => void;
  onEditing: () => void;
}) {
  const context = useProfile()!;
  const account = useAccount()!;
  const [name, setName] = useState(context.profile?.display_name ?? "");
  const [region, setRegion] = useState(
    context.profile?.home_region ?? "The FE",
  );
  const [ao, setAO] = useState(context.profile?.home_ao ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="account-form profile-form"
      onChange={onEditing}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || account.blocked || account.switching || !context.ready)
          return;
        setBusy(true);
        setMessage("");
        try {
          await context.save({
            display_name: name,
            home_region: region,
            home_ao: ao,
          });
          onSaved();
        } catch (problem) {
          setMessage(
            problem instanceof Error
              ? problem.message
              : "Couldn’t save your profile.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{context.profile ? "Your F3 profile" : "Choose your F3 Name"}</h3>
      <label>
        Display Name
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
          aria-describedby="profile-name-help"
        />
      </label>
      <small id="profile-name-help">Use your F3 Name, such as Rug Burn.</small>
      <label>
        Home region (optional)
        <input
          maxLength={120}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
      </label>
      <label>
        Home AO (optional)
        <input
          list="profile-aos"
          maxLength={160}
          value={ao}
          onChange={(e) => setAO(e.target.value)}
        />
      </label>
      <datalist id="profile-aos">
        {aoProfiles.map((value) => (
          <option key={value.id} value={value.name} />
        ))}
      </datalist>
      <button
        disabled={
          busy || account.blocked || account.switching || !context.ready
        }
        type="submit"
      >
        {busy ? "Saving profile…" : "Save profile"}
      </button>
      {context.error && (
        <p role="status">
          {context.error}{" "}
          <button type="button" onClick={context.retry}>
            Retry profile
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
