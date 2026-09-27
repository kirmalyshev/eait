// The walk in one pass: sign in, ten questions, the reveal, the plan, the sign-up.
import { explainTargets, planHeadline, projectGoal, projectionMonth, wholeNumbers, type Profile } from "@eait/shared";
import { expect, onboard, signIn, test } from "./fixtures.ts";

test("a person signs in, answers the questions, and reaches their plan", async ({ page }) => {
  await signIn(page, `pw-smoke-${Date.now()}`);
  // High cholesterol ticked at the medical chips — the declaration whose marker the plan has
  // to name.
  await onboard(page, { medical: ["ldl"] });

  // The board's headline is the goal sentence itself — the S6-exempt line, computed, never typed.
  const profile = {
    user_id: "pw", lang: "en", goal: "lose", sex: "male", birth_year: 1988,
    height_cm: 182, weight_kg: 98, weight_measured_at: null, target_weight_kg: 92,
    activity: "some", pace: "steady", units: null, struggles: null, country: "de", restrictions: ["ldl"],
    medical_limitations: null, food_allergies: null, product_limitations: null,
    onboarded_at: new Date().toISOString(),
  } satisfies Profile;
  await expect(page.locator(".pln .goal")).toHaveText(planHeadline(profile, new Date(), "metric", "en")!);
  const { targets, basis } = explainTargets(profile);
  const projection = projectGoal(profile, basis)!;
  // The month lands inside the estimate card — `projectionMonth`'s, not a literal.
  await expect(page.locator(".pgraph")).toContainText(projectionMonth(new Date(), projection.weeks, "en"));
  const day = page.locator(".mcard", { hasText: "Saturated fat" });
  await expect(day.getByText("Saturated fat")).toBeVisible();
  await expect(day.getByText(`${wholeNumbers("en")(targets.satfat_g!)} g`)).toBeVisible();

  // The plan's one way on is the sign-up (S8): the consent screen, not a meal and not a chat —
  // and THIS account already signed in, so the sign-up bounces it straight to the next step.
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/start\/country/);
});

test("the chat is empty for a new account, and the composer is there", async ({ signedIn }) => {
  await expect(signedIn.getByRole("heading", { name: "Your chat" })).toBeVisible();
  await expect(signedIn.getByPlaceholder("What did you eat?")).toBeVisible();
});

// The walk's numbers are spoken in the units on screen — en-GB pins metric (98 kg,
// not 98 lb), so the answers below are metric numbers and the floors hold.
test.use({ locale: "en-GB" });

