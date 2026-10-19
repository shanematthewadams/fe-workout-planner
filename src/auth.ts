import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cloudConnection, parseCloudSnapshot, type Snapshot } from "./cloud";
import type { Workout } from "./model";
import { isStaging } from "./environment";
let client: SupabaseClient | null = null;
export function authStorageKey() {
  return isStaging() ? "fe-auth:staging:v1" : "fe-auth:v1";
}
export function getAuthClient() {
  const connection = cloudConnection();
  if (!connection) return null;
  client ??= createClient(connection.url, connection.key, {
    auth: {
      flowType: "pkce",
      storageKey: authStorageKey(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
export function accountStorageKey(owner?: string) {
  return owner
    ? `fe-account:${isStaging() ? "staging:" : ""}${owner}:v1`
    : "fe-planner:v1";
}
export function scopedDraftKey(key: string, owner?: string) {
  return owner ? `${key}:account:${owner}` : key;
}
export function signInRedirect() {
  return `${location.origin}/?signin=1#my-workouts`;
}
export function cleanSignInUrl() {
  const url = new URL(location.href);
  const errorHash = /^#error=/.test(url.hash);
  if (
    !["code", "error", "error_code", "error_description", "signin"].some((k) =>
      url.searchParams.has(k),
    ) &&
    !errorHash
  )
    return;
  if (errorHash) url.hash = "settings";
  for (const key of [
    "code",
    "error",
    "error_code",
    "error_description",
    "signin",
  ])
    url.searchParams.delete(key);
  history.replaceState({}, "", url.pathname + url.search + url.hash);
}
export async function accountRequest(
  owner: string,
  operation: "get" | "put",
  expected = 0,
  workouts: Workout[] = [],
  signal?: AbortSignal,
): Promise<Snapshot> {
  const connection = cloudConnection(),
    auth = getAuthClient();
  if (!connection || !auth)
    throw Error("Account saving is unavailable. Your device copy is safe.");
  const { data, error } = await auth.auth.getSession();
  if (error || !data.session || data.session.user.id !== owner)
    throw Error(
      "Sign in again to upload your account workouts. Your device copy is safe.",
    );
  const response = await fetch(
    new URL("/rest/v1/rpc/fe_account_plans", connection.url),
    {
      method: "POST",
      headers: {
        apikey: connection.key,
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation,
        expected_version: expected,
        payload: workouts,
      }),
      signal: AbortSignal.any([
        AbortSignal.timeout(10000),
        ...(signal ? [signal] : []),
      ]),
    },
  );
  if (!response.ok) {
    if (response.status === 409)
      throw Error(
        "Your account changed on another device. Retry saving; both copies are safe.",
      );
    if (response.status === 401 || response.status === 403)
      throw Error(
        "Sign in again to upload your account workouts. Your device copy is safe.",
      );
    throw Error(
      "Account saving is unavailable. Your device copy is safe; retry when connected.",
    );
  }
  return parseCloudSnapshot(await response.json());
}

/** Offline identity selects a device cache only; the server still verifies every JWT. */
export function cachedAccountIdentity(): { id: string; email?: string } | null {
  try {
    const user = JSON.parse(
      localStorage.getItem(authStorageKey()) ?? "null",
    )?.user;
    if (
      !user ||
      typeof user.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(user.id)
    )
      return null;
    return {
      id: user.id,
      ...(typeof user.email === "string" && user.email.length <= 254
        ? { email: user.email }
        : {}),
    };
  } catch {
    return null;
  }
}
