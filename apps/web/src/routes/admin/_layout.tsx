import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getUser } from "@/shared/_utils/get-user";

export const Route = createFileRoute("/admin/_layout")({
  beforeLoad: async () => {
    const session = await getUser();
    if (!session?.user) {
      throw redirect({ to: "/sign-in" });
    }
    if (session.user.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <nav className="flex gap-4 text-sm">
            <a
              href="/admin"
              className="font-medium text-foreground hover:text-primary"
            >
              ダッシュボード
            </a>
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
