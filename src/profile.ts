import { z } from "zod";
import { getAuthClient } from "./auth";
export const profileFieldsSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your F3 Name.").max(80),
  home_region: z.string().trim().max(120).default("The FE"),
  home_ao: z.string().trim().max(160).default(""),
});
export const profileSchema = profileFieldsSchema.extend({
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProfileFields = z.infer<typeof profileFieldsSchema>;
export async function requestProfile(
  owner: string,
  fields?: ProfileFields,
  createOnly = false,
): Promise<Profile | null> {
  const client = getAuthClient();
  if (!client)
    throw Error("Profile settings are unavailable. Your workouts are safe.");
  const { data, error } = await client.auth.getSession();
  if (error || data.session?.user.id !== owner)
    throw Error("Sign in again to update your profile.");
  const parsedFields = fields
    ? profileFieldsSchema.safeParse(fields)
    : undefined;
  if (parsedFields && !parsedFields.success)
    throw Error(
      parsedFields.error.issues[0]?.message ?? "Check your profile fields.",
    );
  const table = client.from("fe_profiles");
  const result = fields
    ? await table
        .upsert(
          {
            ...(parsedFields?.success ? parsedFields.data : {}),
            user_id: owner,
          },
          { onConflict: "user_id", ignoreDuplicates: createOnly },
        )
        .select()
        .abortSignal(AbortSignal.timeout(10000))
        .maybeSingle()
    : await table
        .select()
        .eq("user_id", owner)
        .abortSignal(AbortSignal.timeout(10000))
        .maybeSingle();
  if (result.error)
    throw Error(
      "Couldn’t open or save your profile. Try again when connected. Your workouts are safe.",
    );
  if (createOnly && !result.data) return requestProfile(owner);
  const parsed = result.data ? profileSchema.safeParse(result.data) : null;
  if (parsed && !parsed.success)
    throw Error(
      "Your profile could not be read. Retry when connected; your workouts are safe.",
    );
  const profile = parsed?.success ? parsed.data : null;
  if (profile && profile.user_id !== owner)
    throw Error("Profile account did not match.");
  return profile;
}
