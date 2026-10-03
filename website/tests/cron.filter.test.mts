// Conformance test for the free-model filter against the shared fixture.
//
// The filter (isFreeModel / isFreePricing) is implemented twice in this repo:
// here in website/src/cron.ts and in scripts/post_openrouter_free_models.py.
// scripts/tests/fixtures/free-model-cases.json pins the agreed behavior of both;
// this test asserts the TypeScript implementation against every case.
//
// The repo has no test runner, so this file is a plain Node script. Node >= 22.18
// strips TypeScript types natively, no build or dependencies needed.
//
// Run from the repo root:
//     node website/tests/cron.filter.test.mts
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { isFreeModel } from "../src/cron.ts";

interface FixtureCase {
  description: string;
  id: unknown;
  pricing: unknown;
  expected: boolean;
  expected_ts?: boolean;
}

const fixturePath = new URL(
  "../../scripts/tests/fixtures/free-model-cases.json",
  import.meta.url,
);
const cases = JSON.parse(readFileSync(fixturePath, "utf-8")).cases as FixtureCase[];

let passed = 0;
for (const c of cases) {
  const expected = c.expected_ts ?? c.expected;
  const actual = isFreeModel(
    c.id,
    c.pricing as Record<string, unknown> | null | undefined,
  );
  assert.equal(actual, expected, `case: ${c.description}`);
  passed++;
}
console.log(`ok - ${passed}/${cases.length} fixture cases passed`);
