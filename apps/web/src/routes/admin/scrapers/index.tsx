import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@/lib/orpc/orpc";
import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";

export const Route = createFileRoute("/admin/scrapers/")({
  component: ScrapersPage,
});

function ScrapersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery(
    orpc.scrapers.listJobs.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      refetchInterval: 2000,
    })
  );

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof client.scrapers.createJob>[0]) =>
      client.scrapers.createJob(input),
    onSuccess: () => {
      toast.success("ジョブを作成しました");
      queryClient.invalidateQueries({ queryKey: orpc.scrapers.listJobs.key() });
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">スクレイパー管理</h1>

      <CreateJobForm
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />

      <div className="rounded border border-border bg-card">
        <div className="border-b px-4 py-3 font-semibold text-sm">
          ジョブ一覧 ({total} 件)
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            読み込み中...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            ジョブがありません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">自治体</th>
                <th className="px-4 py-2 text-left">ステータス</th>
                <th className="px-4 py-2 text-left">挿入</th>
                <th className="px-4 py-2 text-left">スキップ</th>
                <th className="px-4 py-2 text-left">作成日時</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-2 font-mono">{job.municipalityId}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {job.totalInserted}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {job.totalSkipped}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/admin/scrapers/${job.id}`}
                      className="text-primary hover:underline text-xs"
                    >
                      詳細
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > PAGE_SIZE && (
          <div className="flex justify-between items-center px-4 py-3 border-t text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              前へ
            </Button>
            <span className="text-muted-foreground">
              {page + 1} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
            >
              次へ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateJobForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (payload: Parameters<typeof client.scrapers.createJob>[0]) => void;
  isSubmitting: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [municipalityId, setMunicipalityId] = useState("");
  const [year, setYear] = useState(String(currentYear));

  const { data: municipalities = [], isLoading: municipalitiesLoading } =
    useQuery(
      orpc.scrapers.listMunicipalities.queryOptions({ input: {} })
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!municipalityId) return;
    onSubmit({ municipalityId, year: parseInt(year, 10) });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-border bg-card p-4 space-y-4"
    >
      <h2 className="font-semibold text-sm">新規ジョブ作成</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="municipality" className="text-xs">
            自治体
          </Label>
          <select
            id="municipality"
            value={municipalityId}
            onChange={(e) => setMunicipalityId(e.target.value)}
            required
            disabled={municipalitiesLoading}
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {municipalitiesLoading ? "読み込み中..." : "自治体を選択"}
            </option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.prefecture} {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="year" className="text-xs">
            年
          </Label>
          <Input
            id="year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            className="mt-1"
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting || !municipalityId} size="sm">
        {isSubmitting ? "作成中..." : "ジョブ作成"}
      </Button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        colors[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}
