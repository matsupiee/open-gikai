import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/lib/orpc/orpc";
import { DateWheelPicker } from "@/shared/_components/date-wheel-picker";
import { MunicipalitySelector } from "@/shared/_components/municipality-selector";
import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";

export const Route = createFileRoute("/meetings/")({
  component: RouteComponent,
});

interface Filters {
  municipalityCodes: string[];
  heldOnFrom: string;
  heldOnTo: string;
  title: string;
}

const defaultFilters: Filters = {
  municipalityCodes: [],
  heldOnFrom: "",
  heldOnTo: "",
  title: "",
};

function RouteComponent() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);

  const dateError =
    appliedFilters.heldOnFrom &&
    appliedFilters.heldOnTo &&
    appliedFilters.heldOnFrom > appliedFilters.heldOnTo
      ? "開始日は終了日より前の日付を指定してください"
      : null;

  const input = {
    ...(appliedFilters.municipalityCodes.length > 0
      ? { municipalityCodes: appliedFilters.municipalityCodes }
      : {}),
    ...(appliedFilters.heldOnFrom ? { heldOnFrom: appliedFilters.heldOnFrom } : {}),
    ...(appliedFilters.heldOnTo ? { heldOnTo: appliedFilters.heldOnTo } : {}),
    ...(appliedFilters.title ? { title: appliedFilters.title } : {}),
    ...(cursor ? { cursor } : {}),
    limit: 20,
  };

  const { data, isLoading } = useQuery(orpc.meetings.list.queryOptions({ input }));

  const hasActiveFilters =
    filters.municipalityCodes.length > 0 || filters.heldOnFrom || filters.heldOnTo || filters.title;

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
            <MunicipalitySelector
              selectedCodes={filters.municipalityCodes}
              onChange={(codes) => setFilters({ ...filters, municipalityCodes: codes })}
            />

            <div className="space-y-1">
              <Label className="text-xs">開催日</Label>
              <div className="flex items-center gap-2">
                <DateWheelPicker
                  value={filters.heldOnFrom}
                  onChange={(v) => setFilters({ ...filters, heldOnFrom: v })}
                  label="開催日（開始）"
                  defaultYear={2021}
                  defaultMonth={1}
                  defaultDay={1}
                />
                <span className="text-xs text-muted-foreground" aria-hidden="true">
                  ~
                </span>
                <DateWheelPicker
                  value={filters.heldOnTo}
                  onChange={(v) => setFilters({ ...filters, heldOnTo: v })}
                  label="開催日（終了）"
                  defaultYear={new Date().getFullYear()}
                  defaultMonth={new Date().getMonth() + 1}
                  defaultDay={new Date().getDate()}
                />
              </div>
              {dateError && (
                <p className="text-xs text-destructive" role="alert">
                  {dateError}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">会議名</Label>
              <Input
                type="text"
                placeholder="例: 定例会"
                value={filters.title}
                onChange={(e) => setFilters({ ...filters, title: e.target.value })}
              />
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
    heldOn: string;
    prefecture: string;
    municipality: string;
  };
}

function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link to="/meetings/$meetingId" params={{ meetingId: meeting.id }} className="block">
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{meeting.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{meeting.heldOn}</span>
            <span>•</span>
            <span>{meeting.prefecture}</span>
            <span>{meeting.municipality}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
