import { projectId } from "../../utils/supabase/info";
import { supabase } from "./supabase";

export type MatchPlayer = {
  id: string;
  name: string;
  source: "roster" | "temporary";
};

export type MatchTeam = {
  id: "team-a" | "team-b";
  name: string;
  players: MatchPlayer[];
};

export type MatchRules = {
  overs: number;
  ballsPerOver: number;
  widePenalty: number;
  noBallPenalty: number;
  freeHit: boolean;
  lastMan: boolean;
  venue?: string;
  scheduledDate: string;
  wicketLimits: { teamA: number; teamB: number };
};

export type MatchToss = {
  method: "physical" | "in-app";
  winnerId: "team-a" | "team-b";
  decision: "bat" | "bowl";
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
};

export type MatchStatus = "draft" | "ready" | "live" | "paused" | "awaiting-second-innings" | "completed" | "abandoned";

export type ExtraType = "wide" | "no-ball" | "bye" | "leg-bye";
export type DismissalType = "bowled" | "caught" | "lbw" | "run-out" | "stumped" | "hit-wicket";

export type ScoreDelivery = {
  id: string;
  sequence: number;
  innings: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batRuns: number;
  completedRuns: number;
  extraType?: ExtraType;
  runningExtraType?: "bye" | "leg-bye";
  extraRuns: number;
  legal: boolean;
  boundary?: 4 | 6;
  wicket?: { playerId: string; type: DismissalType; fielderId?: string; survivingEnd?: "striker" | "non-striker" };
  label: string;
  createdAt: string;
};

export type MatchInnings = {
  battingTeamId: MatchTeam["id"];
  runs: number;
  wickets: number;
  legalBalls: number;
  deliveries: ScoreDelivery[];
  dismissed: string[];
};

export type MatchScoreState = {
  innings: MatchInnings[];
  activeInnings: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batterDisplayOrder: [string, string];
  freeHit: boolean;
  phase: "live" | "new-batter" | "new-bowler" | "innings-break" | "completed";
  result?: string;
  pendingDismissedEnd?: "striker" | "non-striker";
  pendingDismissedPlayerId?: string;
  pendingOverEnd?: boolean;
};

export type CricketMatch = {
  id: string;
  mode: "club-internal" | "club-external" | "quick";
  clubId?: string;
  status: MatchStatus;
  teams: [MatchTeam, MatchTeam];
  rules: MatchRules;
  toss: MatchToss;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  completedAt?: string;
  version?: number;
  score?: MatchScoreState;
  scoringOwnerId?: string;
  corrections?: Array<{ id: string; deliveryId: string; original: unknown; replacement: unknown; actorId: string; createdAt: string }>;
};

const apiUrl = `https://${projectId}.supabase.co/functions/v1/cricapp-api`;

async function request(path: string, options?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Authentication is required");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const text = await response.text();
  let result: Record<string, unknown> = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(response.status === 404 ? "The match service is not deployed yet." : `Invalid match service response (${response.status})`);
  }
  if (!response.ok) throw new Error((result.error as string) || `Unable to complete this request (${response.status})`);
  return result;
}

export async function createMatch(input: Omit<CricketMatch, "id" | "status" | "createdAt" | "createdBy">): Promise<CricketMatch> {
  const result = await request("/matches", { method: "POST", body: JSON.stringify(input) });
  return result.match as CricketMatch;
}

export async function listMatches(): Promise<CricketMatch[]> {
  const { data } = await supabase.auth.getSession();
  const cacheKey = `cricapp-matches:${data.session?.user.id || "anonymous"}`;
  try {
    const result = await request("/matches");
    const matches = result.matches as CricketMatch[];
    localStorage.setItem(cacheKey, JSON.stringify(matches));
    return matches;
  } catch (error) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
}

export async function getMatch(matchId: string): Promise<CricketMatch> {
  const result = await request(`/matches/${matchId}`);
  return result.match as CricketMatch;
}

export async function saveMatchScore(matchId: string, score: MatchScoreState, version: number): Promise<CricketMatch> {
  const result = await request(`/matches/${matchId}/score`, {
    method: "PUT",
    body: JSON.stringify({ score, version }),
  });
  return result.match as CricketMatch;
}

export async function updateMatchStatus(matchId: string, status: "paused" | "abandoned"): Promise<CricketMatch> {
  const result = await request(`/matches/${matchId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  return result.match as CricketMatch;
}

export async function deleteMatch(matchId: string): Promise<void> {
  await request(`/matches/${matchId}`, { method: "DELETE" });
}
