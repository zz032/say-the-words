import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
