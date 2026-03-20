import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/_components/ui/table";
import { TabNav, ProgressBar } from "./prefectures";

export const Route = createFileRoute("/admin/_layout/progress/years")({
  component: YearsPage,
});

function YearsPage() {
  const { data, isLoading } = useQuery(
    orpc.scrapers.progressByYear.queryOptions({ input: {} })
  );

  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">進捗管理</h1>
        <TabNav current="years" />
      </div>

      <div className="rounded border border-border bg-card">
        <div className="border-b px-4 py-3 font-semibold text-sm">
          年度別スクレイピング進捗
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            読み込み中...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">年度</TableHead>
                <TableHead className="px-4">自治体数 (完了/全体)</TableHead>
                <TableHead className="px-4">進捗</TableHead>
                <TableHead className="px-4">ジョブ数</TableHead>
                <TableHead className="px-4">完了</TableHead>
                <TableHead className="px-4">失敗</TableHead>
                <TableHead className="px-4">実行中</TableHead>
                <TableHead className="px-4">挿入件数</TableHead>
                <TableHead className="px-4">スキップ件数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="px-4 font-medium">
                    {row.year}年度
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.completedMunicipalities} / {row.totalMunicipalities}
                  </TableCell>
                  <TableCell className="px-4">
                    <ProgressBar
                      value={row.completedMunicipalities}
                      max={row.totalMunicipalities}
                    />
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.totalJobs}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-700 border-green-200"
                    >
                      {row.completedJobs}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    {row.failedJobs > 0 ? (
                      <Badge
                        variant="outline"
                        className="bg-red-100 text-red-700 border-red-200"
                      >
                        {row.failedJobs}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    {row.activeJobs > 0 ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-700 border-blue-200"
                      >
                        {row.activeJobs}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.totalInserted.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.totalSkipped.toLocaleString("ja-JP")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
