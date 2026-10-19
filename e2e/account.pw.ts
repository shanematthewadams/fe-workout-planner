import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { navigate } from "./navigation";
import type { Workout } from "../src/model";
test.use({ trace: "off" });
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
function sessionFor(id: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id,
    email: `${id[0]}@example.test`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-19T00:00:00Z",
  };
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: id,
        exp,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url"),
    Buffer.from("synthetic-signature").toString("base64url"),
  ].join(".");
  return {
    access_token: jwt,
    refresh_token: `fixture-${id}`,
    expires_in: 3600,
    expires_at: exp,
    token_type: "bearer",
    user,
  };
}

test("optional email links preserve guest plans and isolate signed-in libraries", async ({
  page,
  browser,
}, info) => {
  test.skip(
    !process.env.FE_CLOUD_TEST_DIR || process.env.FE_LIVE_CLOUD === "true",
    "Requires configured auth fixture",
  );
  // This uses only a fake auth/backend service. No messages or real accounts are created.
  const accounts = new Map<string, { version: number; workouts: Workout[] }>();
  let guest = { version: 0, workouts: [] as Workout[] };
  let nextOwner = ownerA;
  let challenge = "";
  let requests = 0;
  const fixture = async (target: Page) => {
    await target.route("https://staging-sync.invalid/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      };
      const fulfill = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers,
          body: JSON.stringify(body),
        });
      if (request.method() === "OPTIONS") return fulfill({}, 204);
      if (url.pathname === "/auth/v1/otp") {
        const body = request.postDataJSON();
        expect(body.phone).toBeUndefined();
        expect(body.email).toBe("q@example.test");
        expect(body.code_challenge_method).toBe("s256");
        expect(body.code_challenge).toBeTruthy();
        challenge = body.code_challenge;
        requests++;
        return fulfill({});
      }
      if (url.pathname === "/auth/v1/token") {
        const body = request.postDataJSON();
        expect(url.searchParams.get("grant_type")).toBe("pkce");
        expect(body.auth_code).toBe("fixture-email-code");
        expect(
          createHash("sha256").update(body.code_verifier).digest("base64url"),
        ).toBe(challenge);
        return fulfill(sessionFor(nextOwner));
      }
      if (url.pathname === "/auth/v1/logout") return fulfill({});
      if (url.pathname === "/auth/v1/user")
        return fulfill(sessionFor(nextOwner).user);
      if (url.pathname === "/rest/v1/rpc/fe_sync_plans") {
        const body = request.postDataJSON();
        if (body.operation === "put")
          guest = { version: guest.version + 1, workouts: body.payload };
        return fulfill(guest);
      }
      if (url.pathname === "/rest/v1/rpc/fe_account_plans") {
        const auth = request.headers().authorization;
        expect(auth).toMatch(/^Bearer /);
        const owner = JSON.parse(
          Buffer.from(auth!.split(".")[1], "base64url").toString(),
        ).sub as string;
        const body = request.postDataJSON();
        expect(body.user_id).toBeUndefined();
        expect(body.sync_code).toBeUndefined();
        let remote = accounts.get(owner) ?? { version: 0, workouts: [] };
        if (body.operation === "put") {
          if (body.expected_version !== remote.version) return fulfill({}, 409);
          remote = { version: remote.version + 1, workouts: body.payload };
          accounts.set(owner, remote);
        }
        return fulfill(remote);
      }
      return fulfill([]);
    });
  };
  await fixture(page);
  await page.goto("http://127.0.0.1:4175/");
  await page
    .getByRole("button", { name: "Formal Builder", exact: true })
    .click();
  await page.getByLabel("Plan title", { exact: true }).fill("Guest original Q");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save a private copy", exact: true })
    .click();
  await expect.poll(() => guest.workouts.length).toBe(1);
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  if (!(await signIn.isVisible()))
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await signIn.click();
  await expect(
    page.getByRole("button", { name: "Close", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("q@example.test");
  await page
    .getByRole("button", { name: "Email me a sign-in link", exact: true })
    .click();
  await expect(page.getByText(/Check your email/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Send again in/ }),
  ).toBeDisabled();
  expect(requests).toBe(1);
  await page.goto(
    "http://127.0.0.1:4175/?code=fixture-email-code&signin=1#my-workouts",
  );
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/#my-workouts$/);
  await expect(
    page.getByRole("button", { name: "Guest original Q", exact: true }),
  ).toHaveCount(0);
  await navigate(page, "Saving & recovery");
  await expect(page.getByText("1@example.test", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Add guest workouts to my account",
      exact: true,
    })
    .click();
  await expect.poll(() => accounts.get(ownerA)?.workouts.length).toBe(1);
  expect(guest.workouts[0].title).toBe("Guest original Q");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-account-settings.png`,
    fullPage: true,
  });
  // An independent browser opens the same account library without a recovery code.
  const otherContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  try {
    await otherContext.addInitScript(
      (session) =>
        localStorage.setItem("fe-auth:staging:v1", JSON.stringify(session)),
      sessionFor(ownerA),
    );
    const other = await otherContext.newPage();
    await fixture(other);
    await other.goto("http://127.0.0.1:4175/#my-workouts");
    await expect(
      other.getByRole("button", { name: "Guest original Q", exact: true }),
    ).toBeVisible();
    await navigate(other, "Saving & recovery");
    await other.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      other.getByRole("heading", { name: "Keep your workouts", exact: true }),
    ).toBeVisible();
    await navigate(other, "My Workouts");
    await expect(
      other.getByRole("button", { name: "Guest original Q", exact: true }),
    ).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
  // Signing out on the original browser restores its untouched guest copy.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep your workouts", exact: true }),
  ).toBeVisible();
  await navigate(page, "My Workouts");
  await expect(
    page.getByRole("button", { name: "Guest original Q", exact: true }),
  ).toBeVisible();
  // A different account starts empty; it never inherits the previous account's cache.
  await navigate(page, "Saving & recovery");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("q@example.test");
  await page
    .getByRole("button", { name: "Email me a sign-in link", exact: true })
    .click();
  await expect(page.getByText(/Check your email/)).toBeVisible();
  nextOwner = ownerB;
  await page.goto(
    "http://127.0.0.1:4175/?code=fixture-email-code&signin=1#my-workouts",
  );
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guest original Q", exact: true }),
  ).toHaveCount(0);
});

test("expired email links leave guest access available and remove callback parameters", async ({
  page,
}) => {
  test.skip(
    !process.env.FE_CLOUD_TEST_DIR || process.env.FE_LIVE_CLOUD === "true",
    "Requires configured auth fixture",
  );
  await page.goto(
    "http://127.0.0.1:4175/?error=access_denied&error_description=expired&signin=1#settings",
  );
  await expect(
    page.getByRole("heading", { name: "Keep your workouts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/That sign-in link could not be opened/).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/#settings$/);
  await navigate(page, "Build");
  await expect(
    page.getByLabel("Describe your Q", { exact: true }),
  ).toBeVisible();
});
