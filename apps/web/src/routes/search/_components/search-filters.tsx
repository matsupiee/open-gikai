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
  prefecture: string;
  setPrefecture: (v: string) => void;
  municipality: string;
  setMunicipality: (v: string) => void;
  assemblyLevel: string;
  setAssemblyLevel: (v: string) => void;
  onReset: () => void;
}

export function SearchFilters({
  kind,
  setKind,
  heldOnFrom,
  setHeldOnFrom,
  heldOnTo,
  setHeldOnTo,
  prefecture,
  setPrefecture,
  municipality,
  setMunicipality,
  assemblyLevel,
  setAssemblyLevel,
  onReset,
}: SearchFiltersProps) {
  const hasActiveFilters = !!(kind || heldOnFrom || heldOnTo || prefecture || municipality || assemblyLevel);

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
          <NativeSelect
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">すべて</NativeSelectOption>
            <NativeSelectOption value="question">質問</NativeSelectOption>
            <NativeSelectOption value="answer">答弁</NativeSelectOption>
            <NativeSelectOption value="remark">発言</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">都道府県名</Label>
          <Input
            type="text"
            placeholder="東京都"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">自治体名</Label>
          <Input
            type="text"
            placeholder="千代田区"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">議会レベル</Label>
          <NativeSelect
            value={assemblyLevel}
            onChange={(e) => setAssemblyLevel(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">すべて</NativeSelectOption>
            <NativeSelectOption value="national">国会</NativeSelectOption>
            <NativeSelectOption value="prefectural">都道府県</NativeSelectOption>
            <NativeSelectOption value="municipal">市区町村</NativeSelectOption>
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
