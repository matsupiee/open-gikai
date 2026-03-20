import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
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
import { TabNav } from "./prefectures";

export const Route = createFileRoute("/admin/_layout/progress/municipalities")({
  validateSearch: (search: Record<string, unknown>) => ({
    prefecture: (search.prefecture as string) || undefined,
  }),
  component: MunicipalitiesPage,
});

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const PAGE_SIZE = 50;

function MunicipalitiesPage() {
  const { prefecture: initialPrefecture } = Route.useSearch();
  const [prefecture, setPrefecture] = useState<string | undefined>(initialPrefecture);
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery(
    orpc.scrapers.progressByMunicipality.queryOptions({
      input: {
        prefecture,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      },
    })
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const handlePrefectureChange = (value: string) => {
    setPrefecture(value === "all" ? undefined : value);
    setPage(0);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">進捗管理</h1>
        <TabNav current="municipalities" />
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={prefecture ?? "all"}
          onValueChange={handlePrefectureChange}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="都道府県で絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {PREFECTURES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {total} 件
        </span>
      </div>

      <div className="rounded border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            読み込み中...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">自治体名</TableHead>
                <TableHead className="px-4">ジョブ数 (完了/全体)</TableHead>
                <TableHead className="px-4">会議数</TableHead>
                <TableHead className="px-4">挿入件数</TableHead>
                <TableHead className="px-4">ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.municipalityId}>
                  <TableCell className="px-4">
                    <span className="text-muted-foreground">
                      {item.prefecture}
                    </span>
                    <span className="ml-1 font-medium">{item.name}</span>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {item.completedJobs} / {item.totalJobs}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {item.totalMeetings.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {item.totalInserted.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="px-4">
                    <MunicipalityStatus item={item} />
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

function MunicipalityStatus({
  item,
}: {
  item: {
    totalJobs: number;
    completedJobs: number;
    activeJobs: number;
  };
}) {
  if (item.totalJobs === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-gray-100 text-gray-700 border-gray-200"
      >
        未着手
      </Badge>
    );
  }
  if (item.activeJobs > 0) {
    return (
      <Badge
        variant="outline"
        className="bg-blue-100 text-blue-700 border-blue-200"
      >
        進行中
      </Badge>
    );
  }
  if (item.completedJobs === item.totalJobs) {
    return (
      <Badge
        variant="outline"
        className="bg-green-100 text-green-700 border-green-200"
      >
        完了
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-yellow-100 text-yellow-700 border-yellow-200"
    >
      一部完了
    </Badge>
  );
}
