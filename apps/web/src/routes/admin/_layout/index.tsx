import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";

export const Route = createFileRoute("/admin/_layout/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data } = useQuery(
    orpc.scrapers.listJobs.queryOptions({ input: { limit: 5, offset: 0 } })
  );

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;

  const running = jobs.filter((j) => j.status === "running").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">管理ダッシュボード</h1>

      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <StatCard label="総ジョブ数" value={total} />
        <StatCard label="実行中" value={running} color="text-blue-600" />
        <StatCard label="完了" value={completed} color="text-green-600" />
        <StatCard label="失敗" value={failed} color="text-red-600" />
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>最近のジョブ</CardTitle>
            <a href="/admin/scrapers" className="text-sm text-primary hover:underline">
              すべて表示 →
            </a>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">ジョブがありません</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {job.municipalityId}
                    </span>
                  </div>
                  <a
                    href={`/admin/scrapers/${job.id}`}
                    className="text-primary hover:underline text-xs"
                  >
                    詳細
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700 border-gray-200",
    running: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };
  return (
    <Badge variant="outline" className={cls[status] ?? "bg-gray-100 text-gray-700 border-gray-200"}>
      {status}
    </Badge>
  );
}
