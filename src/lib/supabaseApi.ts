import { projectId } from "../../utils/supabase/info";
import { createId } from "./id";
import { supabase } from "./supabase";

export type SavedMatchState = {
  runs: number;
  wickets: number;
  balls: number;
  deliveries: Array<{ label: string; runs: number; wicket?: boolean }>;
  updatedAt?: string;
};

const apiUrl = `https://${projectId}.supabase.co/functions/v1/cricapp-api`;

function getDeviceId() {
  const existing = localStorage.getItem("cricapp-device-id");
  if (existing) return existing;

  const id = createId();
  localStorage.setItem("cricapp-device-id", id);
  return id;
}

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
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Supabase returned an invalid response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(result.error || `Supabase request failed with status ${response.status}`);
  }

  return result;
}

export async function loadActiveMatch(): Promise<SavedMatchState | null> {
  const result = await request(`/matches/${getDeviceId()}/active`);
  return result.match ?? null;
}

export async function saveActiveMatch(match: SavedMatchState): Promise<SavedMatchState> {
  const result = await request(`/matches/${getDeviceId()}/active`, {
    method: "POST",
    body: JSON.stringify(match),
  });
  return result.match;
}
