import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";

export const Route = createFileRoute("/meetings/")({
  component: RouteComponent,
});

interface Filters {
  heldOnFrom: string;
  heldOnTo: string;
  prefecture: string;
  municipality: string;
  meetingType: string;
}

const defaultFilters: Filters = {
  heldOnFrom: "",
  heldOnTo: "",
  prefecture: "",
  municipality: "",
  meetingType: "",
};

function RouteComponent() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);

  const input = {
    ...(appliedFilters.heldOnFrom ? { heldOnFrom: appliedFilters.heldOnFrom } : {}),
    ...(appliedFilters.heldOnTo ? { heldOnTo: appliedFilters.heldOnTo } : {}),
    ...(appliedFilters.prefecture ? { prefecture: appliedFilters.prefecture } : {}),
    ...(appliedFilters.municipality ? { municipality: appliedFilters.municipality } : {}),
    ...(appliedFilters.meetingType ? { meetingType: appliedFilters.meetingType } : {}),
    ...(cursor ? { cursor } : {}),
    limit: 20,
  };

  const { data, isLoading } = useQuery(orpc.meetings.list.queryOptions({ input }));

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  function handleSearch() {
    setAppliedFilters(filters);
    setCursor(undefined);
    setCursors([undefined]);
    setPage(0);
  }

  function handleReset() {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setCursor(undefined);
    setCursors([undefined]);
    setPage(0);
  }

  function handleNextPage() {
    if (!data?.nextCursor) return;
    const nextCursors = [...cursors, data.nextCursor];
    setCursors(nextCursors);
    setCursor(data.nextCursor);
    setPage(page + 1);
  }

  function handlePrevPage() {
    if (page === 0) return;
    const prevPage = page - 1;
    const prevCursor = cursors[prevPage];
    setPage(prevPage);
    setCursor(prevCursor);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-6">会議一覧</h1>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">開催日（から）</Label>
                <Input
                  type="date"
                  value={filters.heldOnFrom}
                  onChange={(e) => setFilters({ ...filters, heldOnFrom: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">開催日（まで）</Label>
                <Input
                  type="date"
                  value={filters.heldOnTo}
                  onChange={(e) => setFilters({ ...filters, heldOnTo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">都道府県</Label>
                <Input
                  type="text"
                  placeholder="例: 鹿児島県"
                  value={filters.prefecture}
                  onChange={(e) => setFilters({ ...filters, prefecture: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">自治体名</Label>
                <Input
                  type="text"
                  placeholder="例: 鹿児島市"
                  value={filters.municipality}
                  onChange={(e) => setFilters({ ...filters, municipality: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">会議種別</Label>
                <Input
                  type="text"
                  placeholder="例: 定例会"
                  value={filters.meetingType}
                  onChange={(e) => setFilters({ ...filters, meetingType: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} size="sm">
                絞り込む
              </Button>
              {hasActiveFilters && (
                <Button onClick={handleReset} variant="outline" size="sm">
                  リセット
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading && (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              ))}
            </>
          )}

          {!isLoading && data?.meetings.length === 0 && (
            <div className="rounded border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">会議が見つかりませんでした</p>
            </div>
          )}

          {!isLoading && data && data.meetings.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {page * 20 + 1}〜{page * 20 + data.meetings.length} 件表示
              </div>
              {data.meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}

              <div className="flex gap-2 justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 0}
                >
                  前のページ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!data.nextCursor}
                >
                  次のページ
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface MeetingCardProps {
  meeting: {
    id: string;
    title: string;
    meetingType: string;
    heldOn: string;
    prefecture: string;
    municipality: string;
    sourceUrl: string | null;
    status: string;
  };
}

function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link to="/meetings/$meetingId" params={{ meetingId: meeting.id }} className="block">
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{meeting.title}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-xs">
              {meeting.meetingType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{meeting.heldOn}</span>
            <span>•</span>
            <span>{meeting.prefecture}</span>
            <span>{meeting.municipality}</span>
            {meeting.sourceUrl && (
              <>
                <span>•</span>
                <span className="text-primary">議事録あり</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
