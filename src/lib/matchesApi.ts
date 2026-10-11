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

export type CricketMatch = {
  id: string;
  mode: "club-internal" | "club-external" | "quick";
  clubId?: string;
  status: "ready";
  teams: [MatchTeam, MatchTeam];
  rules: MatchRules;
  toss: MatchToss;
  createdAt: string;
  createdBy: string;
};

const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-28e50dbb`;

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
  const result = await request("/matches");
  return result.matches as CricketMatch[];
}
