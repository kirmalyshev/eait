// The walk in one pass: sign in, ten questions, the plan, the chat.
import { explainTargets, projectGoal, projectionMonth, wholeNumbers, type Profile } from "@eait/shared";
import { expect, onboard, signIn, test } from "./fixtures.ts";

test("a person signs in, answers the questions, and reaches their plan", async ({ page }) => {
  await signIn(page, `pw-smoke-${Date.now()}`);
  // High cholesterol ticked at the restrictions chips — the declaration whose marker the plan has
  // to name.
  await onboard(page, { restrictions: ["ldl"] });
  await expect(page.getByRole("heading", { name: "Here is your plan" })).toBeVisible();

  // The plan keeps the welcome's promise: the month `projectGoal` lands the target in, and the
  // saturated-fat cap the declaration asked for. Every figure is computed from the same answers
  // the walk gave, so the page cannot drift from the engine's own arithmetic.
  const profile = {
    user_id: "pw", lang: "en", goal: "lose", sex: "male", birth_year: 1988,
    height_cm: 182, weight_kg: 98, weight_measured_at: null, target_weight_kg: 92,
    activity: "moderate", pace: "steady", country: "de", restrictions: ["ldl"],
    medical_limitations: null, food_allergies: null, product_limitations: null,
    onboarded_at: new Date().toISOString(),
  } satisfies Profile;
  const { targets, basis } = explainTargets(profile);
  const projection = projectGoal(profile, basis)!;
  await expect(page.getByText(projectionMonth(new Date(), projection.weeks, "en"))).toBeVisible();
  const day = page.locator(".card", { hasText: "Saturated fat" });
  await expect(day.getByText("Saturated fat")).toBeVisible();
  await expect(day.getByText(`${wholeNumbers("en")(targets.satfat_g!)} g`)).toBeVisible();

  // The plan page is the way into the conversation.
  await page.getByRole("link", { name: "Open the chat" }).click();
  await expect(page).toHaveURL(/\/start\/chat/);
});

test("the chat is empty for a new account, and the composer is there", async ({ signedIn }) => {
  await expect(signedIn.getByRole("heading", { name: "Your chat" })).toBeVisible();
  await expect(signedIn.getByPlaceholder("What did you eat?")).toBeVisible();
});
