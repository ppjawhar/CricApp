import assert from "node:assert/strict";
import test from "node:test";
import { allowedDismissals, bowlerConcededRuns, canChangeBowlerBeforeDelivery, completedRunsForDelivery, isLegalDelivery, maximumWickets, nextFreeHit, wicketLimitAfterLastManToggle } from "./cricketRules.ts";

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

test("toggling last-man batting adjusts the current wicket limit", () => {
  assert.equal(wicketLimitAfterLastManToggle(4, true, 5), 5);
  assert.equal(wicketLimitAfterLastManToggle(5, false, 5), 4);
  assert.equal(wicketLimitAfterLastManToggle(3, false, 5, 3), 3);
});

test("a bowler can only be changed before the first delivery of an over", () => {
  assert.equal(canChangeBowlerBeforeDelivery([], 0, 6), true);
  assert.equal(canChangeBowlerBeforeDelivery([{ legal: true }], 6, 6), true);
  assert.equal(canChangeBowlerBeforeDelivery([{ legal: false }], 6, 6), false);
  assert.equal(canChangeBowlerBeforeDelivery([{ legal: true }], 1, 6), false);
});
