import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import { Skeleton } from "@/shared/_components/ui/skeleton";

import type { Meeting } from "../_hooks/useMeetings";
import { formatDate, getLocationText, getStatusBadgeColor } from "../_utils/helpers";

interface MeetingsTableProps {
  meetings: Meeting[];
  isFetching: boolean;
  nextCursor: string | undefined;
  onLoadMore: () => void;
}

export function MeetingsTable({ meetings, isFetching, nextCursor, onLoadMore }: MeetingsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">議事録一覧</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-4 font-medium">タイトル</th>
                <th className="text-left py-2 px-4 font-medium">都道府県/自治体</th>
                <th className="text-left py-2 px-4 font-medium">開催日</th>
                <th className="text-right py-2 px-4 font-medium">発言数</th>
                <th className="text-left py-2 px-4 font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && meetings.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-border">
                    <td className="py-2 px-4"><Skeleton className="h-4 w-3/4" /></td>
                    <td className="py-2 px-4"><Skeleton className="h-4 w-1/2" /></td>
                    <td className="py-2 px-4"><Skeleton className="h-4 w-1/4" /></td>
                    <td className="py-2 px-4 text-right"><Skeleton className="h-4 w-1/4 ml-auto" /></td>
                    <td className="py-2 px-4"><Skeleton className="h-4 w-1/3" /></td>
                  </tr>
                ))
              ) : meetings.length === 0 ? (
                <tr className="border-b border-border">
                  <td colSpan={5} className="py-8 px-4 text-center text-muted-foreground">
                    議事録が見つかりませんでした
                  </td>
                </tr>
              ) : (
                meetings.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-2 px-4 font-medium truncate max-w-xs">{meeting.title}</td>
                    <td className="py-2 px-4">{getLocationText(meeting)}</td>
                    <td className="py-2 px-4">{formatDate(meeting.held_on)}</td>
                    <td className="py-2 px-4 text-right">{meeting.statementsCount}</td>
                    <td className="py-2 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(meeting.status)}`}>
                        {meeting.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {nextCursor && (
          <div className="mt-6 flex justify-center">
            <Button onClick={onLoadMore} variant="outline" disabled={isFetching}>
              {isFetching ? "読み込み中..." : "もっと見る"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
