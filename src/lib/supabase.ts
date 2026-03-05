import { createClient } from '@supabase/supabase-js';

// INSTRUCTIONS:
// 1. Open the file named .env in your project root
// 2. You will see VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// 3. Replace the placeholder text with your actual Supabase Anon Key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if the key is present
export const isConfigured = !!supabaseUrl && !!rawKey;

if (!isConfigured) {
  console.warn("Supabase Anon Key is missing or invalid. Please check your .env file.");
}

// If not configured, use a dummy key to prevent createClient from throwing an error.
// The App component handles the UI for the unconfigured state.
const supabaseKey = isConfigured ? rawKey : 'dummy-key-to-prevent-init-crash';

export const supabase = createClient(supabaseUrl, supabaseKey);