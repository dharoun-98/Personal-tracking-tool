import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AdminUserOverviewRow } from "@/lib/supabase/types";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { Panel } from "@/components/ui/panel";

export const metadata = {
  title: "Command deck",
  // Never let an admin surface into an index.
  robots: { index: false, follow: false, nocache: true },
};

// Account state changes constantly and must never be served from a cache.
export const dynamic = "force-dynamic";

export default async function CommandDeckPage() {
  if (!isAdminConfigured()) {
    return (
      <main className="grid min-h-dvh place-items-center px-5">
        <Panel className="max-w-sm p-6 text-center">
          <p className="text-sm font-semibold">Admin isn&apos;t configured</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-mute">
            Set <code className="text-ink">ADMIN_PASSWORD</code> and a{" "}
            <code className="text-ink">ADMIN_SESSION_SECRET</code> of at least 24
            characters, then redeploy.
          </p>
        </Panel>
      </main>
    );
  }

  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  const admin = getSupabaseAdmin();
  let users: AdminUserOverviewRow[] = [];
  let dbError: string | null = null;

  if (!admin) {
    dbError =
      "No service-role key, so there's nothing to manage. Set SUPABASE_SERVICE_ROLE_KEY.";
  } else {
    const { data, error } = await admin
      .from("admin_user_overview")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) dbError = error.message;
    else users = data ?? [];
  }

  // Access is evaluated in the client component against its shared clock, so
  // "3 days left" keeps ticking on a dashboard someone leaves open, rather
  // than freezing at whatever the server thought when it rendered.
  return <AdminDashboard users={users} dbError={dbError} />;
}
