import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

// env.ts validates process.env and throws at module-evaluation time, so
// each scenario below needs its own independent evaluation of the module
// against exactly the env vars that scenario sets. An earlier version of
// this file tried to get that independence with an in-process cache-busted
// dynamic import (`import("@/config/env?bust=...")`), on the theory that a
// different query string forces Node to re-evaluate the module fresh. It
// doesn't reliably do that: reduced to a two-line repro (import the same
// path twice with different query strings, from two different processes'
// worth of env state), the second import's exported binding could still
// reflect the first import's value even though the two imports produced
// provably distinct module objects. Chasing that further wasn't worth it
// when a fresh OS process for each scenario sidesteps the whole class of
// module-cache questions entirely -- there is no cache, and no shared
// process.env, to leak between scenarios.
//
// Each scenario spawns `node --import tsx -e <program>` (the same loader
// the project's own test script uses) in a fresh child process, with only
// the four env vars this suite cares about explicitly controlled (deleted
// from a copy of the parent's env, then set per scenario) -- everything
// else about the parent's environment (PATH, HOME, etc.) is inherited
// as-is so the child can actually start Node and resolve node_modules.
// The child imports the real src/config/env.ts by absolute file:// URL
// (no path alias needed) and reports the outcome back to the parent as a
// single JSON line on stdout, rather than the parent trying to infer
// pass/fail from the child's exit code or parsing stderr.
//
// No real secret values are used anywhere in this file -- only obviously
// fake placeholder strings.

const RELEVANT_KEYS = [
  "NODE_ENV",
  "JWT_ACCESS_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET",
] as const;

const ENV_TS_PATH = path.resolve(__dirname, "../../src/config/env.ts");
const BACKEND_DIR = path.resolve(__dirname, "../..");

const CHILD_PROGRAM = `
  const { pathToFileURL } = require("node:url");
  import(pathToFileURL(process.env.ENV_TS_PATH_FOR_TEST).href)
    .then((mod) => {
      process.stdout.write(JSON.stringify({
        ok: true,
        razorpayWebhookSecret: mod.env.razorpay.webhookSecret,
        stripeWebhookSecret: mod.env.stripe.webhookSecret,
      }));
    })
    .catch((err) => {
      process.stdout.write(JSON.stringify({
        ok: false,
        message: String((err && err.message) || err),
      }));
    });
`;

interface Scenario {
  NODE_ENV?: string;
  JWT_ACCESS_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

interface ScenarioResult {
  ok: boolean;
  message?: string;
  razorpayWebhookSecret?: string;
  stripeWebhookSecret?: string;
}

function runEnvInFreshProcess(scenario: Scenario): ScenarioResult {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ENV_TS_PATH_FOR_TEST: ENV_TS_PATH };
  for (const key of RELEVANT_KEYS) delete childEnv[key];
  Object.assign(childEnv, scenario);

  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", CHILD_PROGRAM], {
    cwd: BACKEND_DIR,
    env: childEnv,
    encoding: "utf8",
    timeout: 15_000,
  });

  if (result.error) {
    throw new Error(`Failed to spawn child process: ${result.error.message}`);
  }
  const stdout = result.stdout.trim();
  if (!stdout) {
    throw new Error(
      `Child process produced no stdout (exitCode=${result.status}). stderr:\n${result.stderr}`,
    );
  }
  return JSON.parse(stdout) as ScenarioResult;
}

test("A. production + missing RAZORPAY_WEBHOOK_SECRET fails closed", () => {
  const result = runEnvInFreshProcess({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "test-jwt-secret-value",
    STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret-value",
  });
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /RAZORPAY_WEBHOOK_SECRET must be set/);
});

test("B. production + missing STRIPE_WEBHOOK_SECRET fails closed", () => {
  const result = runEnvInFreshProcess({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "test-jwt-secret-value",
    RAZORPAY_WEBHOOK_SECRET: "test-razorpay-webhook-secret-value",
  });
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /STRIPE_WEBHOOK_SECRET must be set/);
});

test("C. production + missing JWT_ACCESS_SECRET still fails (existing behavior unchanged)", () => {
  const result = runEnvInFreshProcess({
    NODE_ENV: "production",
    RAZORPAY_WEBHOOK_SECRET: "test-razorpay-webhook-secret-value",
    STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret-value",
  });
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /JWT_ACCESS_SECRET must be set/);
});

test("D. production + all three secrets configured succeeds with the correct values", () => {
  const result = runEnvInFreshProcess({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "test-jwt-secret-value",
    RAZORPAY_WEBHOOK_SECRET: "test-razorpay-webhook-secret-value",
    STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret-value",
  });
  assert.equal(result.ok, true);
  assert.equal(result.razorpayWebhookSecret, "test-razorpay-webhook-secret-value");
  assert.equal(result.stripeWebhookSecret, "test-stripe-webhook-secret-value");
});

test("E. development + webhook/JWT secrets unset succeeds via the existing dev fallback", () => {
  // NODE_ENV is deliberately left out of the scenario entirely here, not
  // set to the literal string "development" -- env.ts's own default for a
  // genuinely *unset* NODE_ENV is "development" (`process.env.NODE_ENV ??
  // "development"`), and that unset case -- a bare local-dev checkout with
  // no .env file at all -- is exactly what this scenario needs to cover.
  // This does not assert or rely on unset NODE_ENV failing closed; it
  // asserts the opposite, matching env.ts's current, unchanged behavior.
  const result = runEnvInFreshProcess({});
  assert.equal(result.ok, true);
  assert.equal(result.razorpayWebhookSecret, "");
  assert.equal(result.stripeWebhookSecret, "");
});

test("F. development + explicit fake placeholder secrets are exposed unchanged", () => {
  const result = runEnvInFreshProcess({
    NODE_ENV: "development",
    RAZORPAY_WEBHOOK_SECRET: "dev-razorpay-webhook-secret",
    STRIPE_WEBHOOK_SECRET: "dev-stripe-webhook-secret",
  });
  assert.equal(result.ok, true);
  assert.equal(result.razorpayWebhookSecret, "dev-razorpay-webhook-secret");
  assert.equal(result.stripeWebhookSecret, "dev-stripe-webhook-secret");
});
