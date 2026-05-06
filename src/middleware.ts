import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session so it doesn't expire.
  // IMPORTANT: Do not remove this line. Supabase uses getUser() to refresh
  // the auth token. Removing this will cause users to be logged out randomly.
  const { data: { user } } = await supabase.auth.getUser();

  // ----- Role-based routing for the internal sales section -----
  // Only protect /sales/** at the middleware level. The existing /admin and
  // /dashboard areas keep their existing client-side guards (unchanged).
  const pathname = request.nextUrl.pathname;
  const isSalesArea = pathname === "/sales" || pathname.startsWith("/sales/");
  const isInternalApi = pathname.startsWith("/api/sales/");

  if (isSalesArea || isInternalApi) {
    // Not logged in → redirect to /login with returnTo
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
    const internalRole = (user.user_metadata as Record<string, unknown> | undefined)?.internal_role;
    if (internalRole !== "sales" && internalRole !== "sales_admin") {
      // Logged in but not authorised for sales area.
      // For partners → keep them on their dashboard. For admin → on /admin.
      const url = request.nextUrl.clone();
      const partnerId = (user.user_metadata as Record<string, unknown> | undefined)?.partner_id;
      const role = (user.user_metadata as Record<string, unknown> | undefined)?.role;
      if (role === "admin") url.pathname = "/admin";
      else if (partnerId) url.pathname = "/dashboard";
      else url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (images, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
