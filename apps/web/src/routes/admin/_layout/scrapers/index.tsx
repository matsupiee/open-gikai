import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { client, orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/_components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/_components/ui/table";

export const Route = createFileRoute("/admin/_layout/scrapers/")({
  component: ScrapersPage,
});

function ScrapersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery(
    orpc.scrapers.listJobs.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      refetchInterval: 30_000,
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

  const bulkCreateMutation = useMutation({
    mutationFn: (input: Parameters<typeof client.scrapers.createBulkJobs>[0]) =>
      client.scrapers.createBulkJobs(input),
    onSuccess: (data) => {
      toast.success(
        `${data.createdCount} 件のジョブを作成しました（${data.skippedCount} 件スキップ）`
      );
      queryClient.invalidateQueries({ queryKey: orpc.scrapers.listJobs.key() });
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const reprocessMutation = useMutation({
    mutationFn: (input: Parameters<typeof client.scrapers.reprocessStatements>[0]) =>
      client.scrapers.reprocessStatements(input),
    onSuccess: (data) => {
      toast.success(`${data.reprocessedCount} 件の会議を再分割キューに追加しました`);
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const deletePendingMutation = useMutation({
    mutationFn: () => client.scrapers.deletePendingJobs({}),
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} 件の待機中ジョブを削除しました`);
      queryClient.invalidateQueries({ queryKey: orpc.scrapers.listJobs.key() });
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">スクレイパー管理</h1>

      <BulkCreateJobsForm
        onSubmit={(payload) => bulkCreateMutation.mutate(payload)}
        isSubmitting={bulkCreateMutation.isPending}
      />

      <CreateJobForm
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />

      <ReprocessStatementsForm
        onSubmit={(payload) => reprocessMutation.mutate(payload)}
        isSubmitting={reprocessMutation.isPending}
      />

      <div className="rounded border border-border bg-card p-4 space-y-2">
        <div>
          <h2 className="font-semibold text-sm">待機中ジョブ一括削除</h2>
          <p className="text-xs text-muted-foreground mt-1">
            ステータスが pending のジョブをすべて削除します。
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={deletePendingMutation.isPending}
          onClick={() => {
            if (window.confirm("待機中（pending）のジョブをすべて削除しますか？")) {
              deletePendingMutation.mutate();
            }
          }}
        >
          {deletePendingMutation.isPending ? "削除中..." : "待機中ジョブを削除"}
        </Button>
      </div>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">自治体</TableHead>
                <TableHead className="px-4">システム</TableHead>
                <TableHead className="px-4">年度</TableHead>
                <TableHead className="px-4">ステータス</TableHead>
                <TableHead className="px-4">挿入</TableHead>
                <TableHead className="px-4">スキップ</TableHead>
                <TableHead className="px-4">作成日時</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = `/admin/scrapers/${job.id}`;
                  }}
                >
                  <TableCell className="px-4">
                    <div className="flex items-center gap-1 group">
                      <span className="text-muted-foreground">
                        {job.prefecture}
                      </span>
                      <span className="ml-1">
                        {job.municipalityName || job.municipalityId}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const name = job.municipalityName || job.municipalityId;
                          navigator.clipboard.writeText(name);
                          toast.success(`"${name}" をコピーしました`);
                        }}
                        className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        aria-label="自治体名をコピー"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {job.systemTypeDescription ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {job.year}年度
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {job.totalInserted}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {job.totalSkipped}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString("ja-JP")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

function BulkCreateJobsForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (payload: Parameters<typeof client.scrapers.createBulkJobs>[0]) => void;
  isSubmitting: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const yearOptions = Array.from(
    { length: currentYear - 2000 + 1 },
    (_, i) => currentYear - i
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ year });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-border bg-card p-4 space-y-4"
    >
      <div>
        <h2 className="font-semibold text-sm">年度一括スクレイピング</h2>
        <p className="text-xs text-muted-foreground mt-1">
          年度を選択すると、有効な全自治体に対してジョブを一括作成します。既にアクティブなジョブがある自治体はスキップされます。
        </p>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <Label htmlFor="bulk-year" className="text-xs">
            年度
          </Label>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger id="bulk-year" className="mt-1 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? "作成中..." : "一括実行"}
        </Button>
      </div>
    </form>
  );
}

/** コンボボックスの選択状態を明示的に表す型 */
type MunicipalitySelection =
  | { kind: "idle" }
  | { kind: "searching"; query: string }
  | { kind: "selected"; id: string; label: string };

function CreateJobForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (payload: Parameters<typeof client.scrapers.createJob>[0]) => void;
  isSubmitting: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [selection, setSelection] = useState<MunicipalitySelection>({
    kind: "idle",
  });
  const [year, setYear] = useState(currentYear);

  const { data: municipalities = [], isLoading: municipalitiesLoading } =
    useQuery(orpc.scrapers.listMunicipalities.queryOptions({ input: {} }));

  const query = selection.kind === "searching" ? selection.query : "";
  const filtered =
    selection.kind === "searching" && query.trim()
      ? municipalities.filter((m) => {
          const text = `${m.prefecture}${m.name}`;
          const terms = query.trim().split(/\s+/);
          return terms.every((term) => text.includes(term));
        })
      : [];

  const inputValue =
    selection.kind === "selected"
      ? selection.label
      : selection.kind === "searching"
      ? selection.query
      : "";

  const handleInputChange = (value: string) => {
    setSelection(
      value ? { kind: "searching", query: value } : { kind: "idle" }
    );
  };

  const handleSelect = (m: {
    id: string;
    prefecture: string;
    name: string;
  }) => {
    setSelection({
      kind: "selected",
      id: m.id,
      label: `${m.prefecture} ${m.name}`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selection.kind !== "selected") return;
    onSubmit({ municipalityId: selection.id, year });
  };

  const yearOptions = Array.from(
    { length: currentYear - 2000 + 1 },
    (_, i) => currentYear - i
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-border bg-card p-4 space-y-4"
    >
      <h2 className="font-semibold text-sm">新規ジョブ作成</h2>

      <div className="flex gap-8">
        <div className="space-y-1 flex-shrink-0 w-80">
          <Label htmlFor="municipality-search" className="text-xs">
            自治体
          </Label>
          <div className="relative">
            <div className="relative flex w-full cursor-text rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Input
                id="municipality-search"
                placeholder="都道府県・市区町村名で絞り込み"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={() => {
                  // 少し遅らせてクリックイベントが先に発火するようにする
                  setTimeout(() => {
                    if (selection.kind === "searching") {
                      setSelection({ kind: "idle" });
                    }
                  }, 150);
                }}
                disabled={
                  municipalitiesLoading || selection.kind === "selected"
                }
                className={`border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 pr-7 ${
                  selection.kind === "selected"
                    ? "text-green-600 font-medium"
                    : ""
                }`}
              />
              {selection.kind === "selected" && (
                <button
                  type="button"
                  onClick={() => setSelection({ kind: "idle" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="選択解除"
                >
                  ✕
                </button>
              )}
            </div>
            {selection.kind === "searching" && query.trim() && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md">
                {filtered.length === 0 ? (
                  <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                    該当なし
                  </li>
                ) : (
                  filtered.map((m) => (
                    <li
                      key={m.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // blur を発火させない
                        handleSelect(m);
                      }}
                      className="cursor-pointer px-2 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      <span>{m.prefecture} {m.name}</span>
                      {m.systemTypeDescription && (
                        <span className="ml-2 text-muted-foreground">
                          {m.systemTypeDescription}
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="year" className="text-xs">
            年
          </Label>

          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger id="year" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || selection.kind !== "selected"}
        size="sm"
      >
        {isSubmitting ? "作成中..." : "ジョブ作成"}
      </Button>
    </form>
  );
}

function ReprocessStatementsForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (payload: Parameters<typeof client.scrapers.reprocessStatements>[0]) => void;
  isSubmitting: boolean;
}) {
  const [selection, setSelection] = useState<MunicipalitySelection>({ kind: "idle" });

  const { data: municipalities = [], isLoading: municipalitiesLoading } =
    useQuery(orpc.scrapers.listMunicipalities.queryOptions({ input: {} }));

  const query = selection.kind === "searching" ? selection.query : "";
  const filtered =
    selection.kind === "searching" && query.trim()
      ? municipalities.filter((m) => {
          const text = `${m.prefecture}${m.name}`;
          const terms = query.trim().split(/\s+/);
          return terms.every((term) => text.includes(term));
        })
      : [];

  const inputValue =
    selection.kind === "selected"
      ? selection.label
      : selection.kind === "searching"
      ? selection.query
      : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selection.kind !== "selected") return;
    onSubmit({ municipalityId: selection.id });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-border bg-card p-4 space-y-4"
    >
      <div>
        <h2 className="font-semibold text-sm">発言再分割</h2>
        <p className="text-xs text-muted-foreground mt-1">
          自治体を選択して実行すると、既存の発言データを削除して再スクレイピングします。scraper-workerが次回起動時に処理します。
        </p>
      </div>

      <div className="space-y-1 w-80">
        <Label className="text-xs">自治体</Label>
        <div className="relative">
          <div className="relative flex w-full cursor-text rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Input
              placeholder="都道府県・市区町村名で絞り込み"
              value={inputValue}
              onChange={(e) =>
                setSelection(
                  e.target.value
                    ? { kind: "searching", query: e.target.value }
                    : { kind: "idle" }
                )
              }
              onBlur={() => {
                setTimeout(() => {
                  if (selection.kind === "searching") {
                    setSelection({ kind: "idle" });
                  }
                }, 150);
              }}
              disabled={municipalitiesLoading || selection.kind === "selected"}
              className={`border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 pr-7 ${
                selection.kind === "selected" ? "text-green-600 font-medium" : ""
              }`}
            />
            {selection.kind === "selected" && (
              <button
                type="button"
                onClick={() => setSelection({ kind: "idle" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="選択解除"
              >
                ✕
              </button>
            )}
          </div>
          {selection.kind === "searching" && query.trim() && (
            <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md">
              {filtered.length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                  該当なし
                </li>
              ) : (
                filtered.map((m) => (
                  <li
                    key={m.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelection({
                        kind: "selected",
                        id: m.id,
                        label: `${m.prefecture} ${m.name}`,
                      });
                    }}
                    className="cursor-pointer px-2 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span>{m.prefecture} {m.name}</span>
                    {m.systemTypeDescription && (
                      <span className="ml-2 text-muted-foreground">
                        {m.systemTypeDescription}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      <Button
        type="submit"
        variant="destructive"
        disabled={isSubmitting || selection.kind !== "selected"}
        size="sm"
      >
        {isSubmitting ? "処理中..." : "発言を再分割"}
      </Button>
    </form>
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
    <Badge
      variant="outline"
      className={cls[status] ?? "bg-gray-100 text-gray-700 border-gray-200"}
    >
      {status}
    </Badge>
  );
}
