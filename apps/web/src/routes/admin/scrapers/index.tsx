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

type Source = "ndl" | "kagoshima" | "local";

const SOURCE_LABELS: Record<Source, string> = {
  ndl: "国会議事録 (NDL)",
  kagoshima: "鹿児島市議会",
  local: "ローカル自治体",
};

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
                <th className="px-4 py-2 text-left">ソース</th>
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
                  <td className="px-4 py-2 font-mono">{job.source}</td>
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
  const [source, setSource] = useState<Source>("ndl");
  const [from, setFrom] = useState("2024-01-01");
  const [until, setUntil] = useState("2024-12-31");
  const [year, setYear] = useState("");
  const [limit, setLimit] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    if (source === "ndl") {
      onSubmit({ source: "ndl", config: { from, until, limit: limitNum } });
    } else if (source === "kagoshima") {
      onSubmit({
        source: "kagoshima",
        config: {
          year: year ? parseInt(year, 10) : undefined,
          limit: limitNum,
        },
      });
    } else {
      onSubmit({ source: "local", config: { targets: [], limit: limitNum } });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-border bg-card p-4 space-y-4"
    >
      <h2 className="font-semibold text-sm">新規ジョブ作成</h2>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="source" className="text-xs">
            ソース
          </Label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
          >
            {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {source === "ndl" && (
          <>
            <div>
              <Label htmlFor="from" className="text-xs">
                開始日
              </Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="until" className="text-xs">
                終了日
              </Label>
              <Input
                id="until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="mt-1"
              />
            </div>
          </>
        )}

        {source === "kagoshima" && (
          <div>
            <Label htmlFor="year" className="text-xs">
              年度 (任意)
            </Label>
            <Input
              id="year"
              type="number"
              placeholder="例: 2024"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        <div>
          <Label htmlFor="limit" className="text-xs">
            上限件数 (任意)
          </Label>
          <Input
            id="limit"
            type="number"
            placeholder="無制限"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} size="sm">
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
