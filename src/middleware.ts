import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session on every navigation.
 *
 * Access tokens are short-lived. Without this the refresh only happens in the
 * browser, so a server component rendering a signed-in page after the token
 * expired would see a logged-out user and bounce them to sign-in.
 *
 * This deliberately does NOT gate access to routes. Authorisation lives in the
 * pages themselves, where it can read account status too; middleware here is
 * purely about keeping the cookie fresh.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  // No Supabase configured — the app runs local-only, nothing to refresh.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        for (const { name, value } of items) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Calling getUser() is what actually performs the refresh. Do not remove it,
  // and do not replace it with getSession(), which reads the cookie without
  // validating it against the auth server.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the service worker. Notably the
     * service worker and manifest must be excluded — running middleware on
     * them can rewrite their scope and silently break installation.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};
