import type { DismissalType, ExtraType } from "./matchesApi.ts";

export type DeliveryInput = {
  batRuns: number;
  extraType?: ExtraType;
  runningExtraType?: "bye" | "leg-bye";
  extraRuns: number;
};

export function isLegalDelivery(extraType?: ExtraType) {
  return extraType !== "wide" && extraType !== "no-ball";
}

export function completedRunsForDelivery(delivery: DeliveryInput, widePenalty: number, noBallPenalty: number) {
  if (delivery.extraType === "wide") return Math.max(0, delivery.extraRuns - widePenalty);
  if (delivery.extraType === "no-ball") return delivery.runningExtraType ? Math.max(0, delivery.extraRuns - noBallPenalty) : delivery.batRuns;
  return delivery.batRuns || delivery.extraRuns;
}

export function bowlerConcededRuns(delivery: DeliveryInput, noBallPenalty: number) {
  if (delivery.extraType === "bye" || delivery.extraType === "leg-bye") return delivery.batRuns;
  if (delivery.extraType === "no-ball" && delivery.runningExtraType) return delivery.batRuns + noBallPenalty;
  return delivery.batRuns + delivery.extraRuns;
}

export function nextFreeHit(current: boolean, extraType: ExtraType | undefined, enabled: boolean) {
  if (extraType === "no-ball" && enabled) return true;
  if (isLegalDelivery(extraType)) return false;
  return current;
}

export function allowedDismissals(freeHit: boolean, extraType?: ExtraType): DismissalType[] {
  if (freeHit || extraType === "no-ball") return ["run-out"];
  return ["bowled", "caught", "lbw", "run-out", "stumped", "hit-wicket"];
}

export function maximumWickets(players: number, lastMan: boolean) {
  return Math.max(1, players - (lastMan ? 0 : 1));
}

export function wicketLimitAfterLastManToggle(
  currentLimit: number,
  enablingLastMan: boolean,
  players: number,
  wicketsTaken = 0,
) {
  const minimum = Math.max(1, wicketsTaken);
  const maximum = maximumWickets(players, enablingLastMan);
  const adjusted = currentLimit + (enablingLastMan ? 1 : -1);
  return Math.min(maximum, Math.max(minimum, adjusted));
}

export function canChangeBowlerBeforeDelivery(
  deliveries: Array<{ legal: boolean }>,
  legalBalls: number,
  ballsPerOver: number,
) {
  if (!deliveries.length) return true;
  const lastDelivery = deliveries[deliveries.length - 1];
  return lastDelivery.legal && legalBalls % ballsPerOver === 0;
}
