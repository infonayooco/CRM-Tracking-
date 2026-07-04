import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Refreshes the Supabase auth session on every request and returns a response
// carrying any rotated auth cookies. Session-refresh only for now (no route
// gating) so the app keeps working before the login UI ships in a later phase.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Not configured yet (e.g. env vars not set on the host) — pass through so the
  // app keeps serving instead of 500ing on every request.
  if (!url || !key) return response;

  try {
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // Do not run other logic between client creation and getUser(): it refreshes
    // the token and any early return would drop the rotated cookies.
    await supabase.auth.getUser();
  } catch {
    // A Supabase/network failure must never take the whole site down.
    return NextResponse.next({ request });
  }

  return response;
}
