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
  players: ClubPlayer[];
  membership?: { role: "admin" | "organizer" | "scorer" | "member" };
  joined?: boolean;
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
  const responseText = await response.text();
  let result: { error?: string; [key: string]: unknown } = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      if (response.status === 404) {
        throw new Error("The club service is not deployed yet. Redeploy the latest Edge Function from Make settings.");
      }
      throw new Error(`The club service returned an invalid response (${response.status}).`);
    }
  }

  if (!response.ok) throw new Error(result.error || `Unable to complete this request (${response.status})`);
  return result;
}

export async function listClubs(): Promise<{ myClubs: Club[]; browseClubs: Club[] }> {
  return request("/clubs");
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
