import assert from "node:assert/strict";
import test from "node:test";
import { allowedDismissals, bowlerConcededRuns, completedRunsForDelivery, isLegalDelivery, maximumWickets, nextFreeHit } from "./cricketRules.ts";

test("wide and no-ball replacement deliveries do not count as legal balls", () => {
  assert.equal(isLegalDelivery("wide"), false);
  assert.equal(isLegalDelivery("no-ball"), false);
  assert.equal(isLegalDelivery("bye"), true);
});

test("penalty runs do not rotate strike", () => {
  assert.equal(completedRunsForDelivery({ batRuns: 0, extraType: "wide", extraRuns: 1 }, 1, 1), 0);
  assert.equal(completedRunsForDelivery({ batRuns: 0, extraType: "wide", extraRuns: 2 }, 1, 1), 1);
  assert.equal(completedRunsForDelivery({ batRuns: 0, extraType: "no-ball", runningExtraType: "bye", extraRuns: 3 }, 1, 1), 2);
});

test("no-ball byes are not charged to the bowler", () => {
  assert.equal(bowlerConcededRuns({ batRuns: 0, extraType: "no-ball", runningExtraType: "bye", extraRuns: 3 }, 1), 1);
});

test("a wide retains a pending free hit and a legal ball consumes it", () => {
  assert.equal(nextFreeHit(false, "no-ball", true), true);
  assert.equal(nextFreeHit(true, "wide", true), true);
  assert.equal(nextFreeHit(true, undefined, true), false);
});

test("only run-out is accepted on a free hit", () => {
  assert.deepEqual(allowedDismissals(true), ["run-out"]);
  assert.ok(allowedDismissals(false).includes("caught"));
});

test("last-man batting increases the maximum wicket limit", () => {
  assert.equal(maximumWickets(5, false), 4);
  assert.equal(maximumWickets(5, true), 5);
});
