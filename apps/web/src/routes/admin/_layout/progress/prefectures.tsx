import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/_components/ui/table";
import { Badge } from "@/shared/_components/ui/badge";

export const Route = createFileRoute("/admin/_layout/progress/prefectures")({
  component: PrefecturesPage,
});

function TabNav({ current }: { current: "prefectures" | "municipalities" | "years" }) {
  const tabs = [
    { key: "prefectures" as const, label: "都道府県別", href: "/admin/progress/prefectures" },
    { key: "municipalities" as const, label: "自治体別", href: "/admin/progress/municipalities" },
    { key: "years" as const, label: "年度別", href: "/admin/progress/years" },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            current === tab.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function PrefecturesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(
    orpc.scrapers.progressByPrefecture.queryOptions({ input: {} })
  );

  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">進捗管理</h1>
        <TabNav current="prefectures" />
      </div>

      <div className="rounded border border-border bg-card">
        <div className="border-b px-4 py-3 font-semibold text-sm">
          都道府県別スクレイピング進捗
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
                <TableHead className="px-4">都道府県</TableHead>
                <TableHead className="px-4">自治体数 (済/全体)</TableHead>
                <TableHead className="px-4">完了率</TableHead>
                <TableHead className="px-4">ジョブ数</TableHead>
                <TableHead className="px-4">失敗</TableHead>
                <TableHead className="px-4">会議数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.prefecture}
                  className="cursor-pointer"
                  onClick={() => {
                    navigate({
                      to: "/admin/progress/municipalities",
                      search: { prefecture: row.prefecture },
                    });
                  }}
                >
                  <TableCell className="px-4 font-medium">
                    {row.prefecture}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.scrapedMunicipalities} / {row.totalMunicipalities}
                  </TableCell>
                  <TableCell className="px-4">
                    <ProgressBar
                      value={row.scrapedMunicipalities}
                      max={row.totalMunicipalities}
                    />
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.totalJobs}
                    {row.activeJobs > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-2 bg-blue-100 text-blue-700 border-blue-200"
                      >
                        {row.activeJobs} 実行中
                      </Badge>
                    )}
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
                  <TableCell className="px-4 text-muted-foreground">
                    {row.totalMeetings.toLocaleString("ja-JP")}
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

export { TabNav, ProgressBar };
