import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Export a shared Supabase client for convenience (used by pages/components)
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  if (supabase) {
    _supabase = supabase;
    return _supabase;
  }
  if (!supabaseUrl || !supabaseAnonKey) return null;
  _supabase = createClient(supabaseUrl, supabaseAnonKey);
  return _supabase;
}

// Database types
export type Role = "admin" | "speaker" | "listener";

export interface Participant {
  id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  content: string;
  sender_role: Role;
  sender_user_id: string;
  created_at: string;
}
