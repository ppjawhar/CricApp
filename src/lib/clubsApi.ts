import { projectId } from "../../utils/supabase/info";
import { supabase } from "./supabase";

export type ClubPlayer = {
  id: string;
  name: string;
  nickname?: string;
  role?: string;
  status: "active" | "archived";
  createdAt: string;
};

export type ClubInvitation = {
  id: string;
  clubId: string;
  clubName: string;
  email: string;
  role: "admin" | "organizer" | "member";
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};

export type ClubMember = {
  userId: string;
  name?: string;
  email?: string;
  role: "admin" | "organizer" | "member";
  joinedAt: string;
  isCreator: boolean;
};

export type Club = {
  id: string;
  name: string;
  location?: string;
  initials: string;
  createdAt: string;
  createdBy: string;
  memberCount: number;
  matchCount: number;
  record: { wins: number; losses: number; ties: number };
  internalMatchCount?: number;
  externalMatchCount?: number;
  abandonedCount?: number;
  playerStats?: Array<{
    playerId: string;
    appearances: number;
    innings: number;
    runs: number;
    balls: number;
    highest: number;
    fours: number;
    sixes: number;
    wickets: number;
    ballsBowled: number;
    oversEquivalent: number;
    runsConceded: number;
  }>;
  recentMatches?: import("./matchesApi").CricketMatch[];
  players: ClubPlayer[];
  members?: ClubMember[];
  pendingInvitations?: ClubInvitation[];
  membership?: { role: "admin" | "organizer" | "scorer" | "member" };
  joined?: boolean;
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
  const responseText = await response.text();
  let result: { error?: string; [key: string]: unknown } = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      if (response.status === 404) {
        throw new Error("The club service is not deployed yet. Redeploy the latest Supabase Edge Function.");
      }
      throw new Error(`The club service returned an invalid response (${response.status}).`);
    }
  }

  if (!response.ok) throw new Error(result.error || `Unable to complete this request (${response.status})`);
  return result;
}

export async function listClubs(): Promise<{ myClubs: Club[]; browseClubs: Club[] }> {
  const { data } = await supabase.auth.getSession();
  const cacheKey = `cricapp-clubs:${data.session?.user.id || "anonymous"}`;
  try {
    const result = await request("/clubs") as { myClubs: Club[]; browseClubs: Club[] };
    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (error) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
}

export async function createClub(input: { name: string; location?: string }): Promise<Club> {
  const result = await request("/clubs", { method: "POST", body: JSON.stringify(input) });
  return result.club as Club;
}

export async function getClub(clubId: string): Promise<Club> {
  const result = await request(`/clubs/${clubId}`);
  return result.club as Club;
}

export async function updateClub(clubId: string, input: { name: string; location?: string }): Promise<Club> {
  const result = await request(`/clubs/${clubId}`, { method: "PUT", body: JSON.stringify(input) });
  return result.club as Club;
}

export async function deleteClub(clubId: string): Promise<void> {
  await request(`/clubs/${clubId}`, { method: "DELETE" });
}

export async function addClubPlayer(clubId: string, input: { name: string; nickname?: string; role?: string }): Promise<Club> {
  const result = await request(`/clubs/${clubId}/players`, { method: "POST", body: JSON.stringify(input) });
  return result.club as Club;
}

export async function updateClubPlayer(
  clubId: string,
  playerId: string,
  input: { name: string; nickname?: string; role?: string; status: "active" | "archived" },
): Promise<Club> {
  const result = await request(`/clubs/${clubId}/players/${playerId}`, { method: "PUT", body: JSON.stringify(input) });
  return result.club as Club;
}

export async function removeClubPlayer(
  clubId: string,
  playerId: string,
): Promise<Club> {
  const result = await request(`/clubs/${clubId}/players/${playerId}`, {
    method: "DELETE",
  });
  return result.club as Club;
}

export async function inviteClubMember(clubId: string, email: string, role: ClubInvitation["role"]): Promise<ClubInvitation> {
  const result = await request(`/clubs/${clubId}/invitations`, { method: "POST", body: JSON.stringify({ email, role }) });
  return result.invitation as ClubInvitation;
}

export async function listInvitations(): Promise<ClubInvitation[]> {
  const result = await request("/invitations");
  return result.invitations as ClubInvitation[];
}

export async function respondToInvitation(invitationId: string, decision: "accept" | "decline"): Promise<void> {
  await request(`/invitations/${invitationId}/respond`, { method: "POST", body: JSON.stringify({ decision }) });
}

export async function updateClubMemberRole(
  clubId: string,
  memberId: string,
  role: ClubMember["role"],
): Promise<void> {
  await request(`/clubs/${clubId}/members/${memberId}`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export async function removeClubMember(
  clubId: string,
  memberId: string,
): Promise<void> {
  await request(`/clubs/${clubId}/members/${memberId}`, { method: "DELETE" });
}
