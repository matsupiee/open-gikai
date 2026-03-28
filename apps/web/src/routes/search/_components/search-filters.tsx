import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/shared/_components/ui/native-select";

interface SearchFiltersProps {
  kind: string;
  setKind: (v: string) => void;
  heldOnFrom: string;
  setHeldOnFrom: (v: string) => void;
  heldOnTo: string;
  setHeldOnTo: (v: string) => void;
  onReset: () => void;
  dateError: string | null;
}

export function SearchFilters({
  kind,
  setKind,
  heldOnFrom,
  setHeldOnFrom,
  heldOnTo,
  setHeldOnTo,
  onReset,
  dateError,
}: SearchFiltersProps) {
  const hasActiveFilters = !!(kind || heldOnFrom || heldOnTo);

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs text-muted-foreground">フィルター</legend>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-held-on-from" className="text-xs">
            開催日（から）
          </Label>
          <Input
            id="filter-held-on-from"
            type="date"
            value={heldOnFrom}
            max={heldOnTo || undefined}
            onChange={(e) => setHeldOnFrom(e.target.value)}
            className="text-xs"
            aria-invalid={dateError ? "true" : undefined}
            aria-describedby={dateError ? "date-error" : undefined}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-held-on-to" className="text-xs">
            開催日（まで）
          </Label>
          <Input
            id="filter-held-on-to"
            type="date"
            value={heldOnTo}
            min={heldOnFrom || undefined}
            onChange={(e) => setHeldOnTo(e.target.value)}
            className="text-xs"
            aria-invalid={dateError ? "true" : undefined}
            aria-describedby={dateError ? "date-error" : undefined}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-kind" className="text-xs">
            発言種別
          </Label>
          <NativeSelect
            id="filter-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">すべて</NativeSelectOption>
            <NativeSelectOption value="question">質問</NativeSelectOption>
            <NativeSelectOption value="answer">答弁</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {dateError && (
        <p id="date-error" className="text-xs text-destructive" role="alert">
          {dateError}
        </p>
      )}

      {hasActiveFilters && (
        <Button onClick={onReset} variant="outline" size="sm" className="w-full">
          フィルターをリセット
        </Button>
      )}
    </fieldset>
  );
}
