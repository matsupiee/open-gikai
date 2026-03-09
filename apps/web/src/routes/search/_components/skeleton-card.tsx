import { Card, CardContent, CardHeader } from "@/shared/_components/ui/card";
import { Skeleton } from "@/shared/_components/ui/skeleton";

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
}
