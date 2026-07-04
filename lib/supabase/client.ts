import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Browser Supabase client. The publishable key is safe to expose client-side;
// Row-Level Security (see supabase/migrations) is what actually guards the data.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
