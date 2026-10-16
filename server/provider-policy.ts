/** Read-only AI Studio verification on 2026-10-16: the newly created key's masked suffix matched Netlify metadata and this project showed Free tier. No billing settings were changed. Reverify this policy if replacing the key or enabling project billing. */
export const geminiFreeTierPolicy = {
  projectId: "gen-lang-client-0481939256",
  maskedKeySuffix: "-Ldg",
  verifiedAt: "2026-10-16",
  tier: "Free tier",
};
export function isVerifiedFreeGeminiKey(key: string | undefined) {
  return !!key && key.endsWith(geminiFreeTierPolicy.maskedKeySuffix);
}
