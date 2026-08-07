import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL no configurada");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY no configurada");
}

console.log("SUPABASE URL REAL:", import.meta.env.VITE_SUPABASE_URL);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
