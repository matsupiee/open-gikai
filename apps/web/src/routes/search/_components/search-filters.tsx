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
}

export function SearchFilters({
  kind,
  setKind,
  heldOnFrom,
  setHeldOnFrom,
  heldOnTo,
  setHeldOnTo,
  onReset,
}: SearchFiltersProps) {
  const hasActiveFilters = !!(kind || heldOnFrom || heldOnTo);

  return (
    <div className="grid gap-3 rounded border border-border bg-card p-4">
      <h3 className="font-semibold text-sm">フィルター</h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">開催日（から）</Label>
          <Input
            type="date"
            value={heldOnFrom}
            onChange={(e) => setHeldOnFrom(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">開催日（まで）</Label>
          <Input
            type="date"
            value={heldOnTo}
            onChange={(e) => setHeldOnTo(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">発言種別</Label>
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
            <NativeSelectOption value="">すべて</NativeSelectOption>
            <NativeSelectOption value="question">質問</NativeSelectOption>
            <NativeSelectOption value="answer">答弁</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {hasActiveFilters && (
        <Button onClick={onReset} variant="outline" size="sm" className="w-full">
          フィルターをリセット
        </Button>
      )}
    </div>
  );
}
