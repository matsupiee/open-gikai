import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_layout/progress/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/progress/prefectures" });
  },
});
