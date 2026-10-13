/* Table schema:
CREATE TABLE kv_store_28e50dbb (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);
*/

// View at https://supabase.com/dashboard/project/rhgltihfwacenecyrnqv/database/tables

// CricApp persistence. Keep the existing table name to retain saved clubs and matches.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

// Set stores a key-value pair in the database.
export const set = async (key: string, value: any): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_28e50dbb").upsert({
    key,
    value
  });
  if (error) {
    throw new Error(error.message);
  }
};

// Get retrieves a key-value pair from the database.
export const get = async (key: string): Promise<any> => {
  const supabase = client()
  const { data, error } = await supabase.from("kv_store_28e50dbb").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.value;
};

// Delete deletes a key-value pair from the database.
export const del = async (key: string): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_28e50dbb").delete().eq("key", key);
  if (error) {
    throw new Error(error.message);
  }
};

// Sets multiple key-value pairs in the database.
export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_28e50dbb").upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
  if (error) {
    throw new Error(error.message);
  }
};

// Gets multiple key-value pairs from the database.
export const mget = async (keys: string[]): Promise<any[]> => {
  const supabase = client()
  const { data, error } = await supabase.from("kv_store_28e50dbb").select("value").in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};

// Deletes multiple key-value pairs from the database.
export const mdel = async (keys: string[]): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_28e50dbb").delete().in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
};

// Search for key-value pairs by prefix.
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const supabase = client()
  const { data, error } = await supabase.from("kv_store_28e50dbb").select("key, value").like("key", prefix + "%");
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};
