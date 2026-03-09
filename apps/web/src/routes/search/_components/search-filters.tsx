import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";

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
          <label className="text-xs font-medium">開催日（から）</label>
          <Input
            type="date"
            value={heldOnFrom}
            onChange={(e) => setHeldOnFrom(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">開催日（まで）</label>
          <Input
            type="date"
            value={heldOnTo}
            onChange={(e) => setHeldOnTo(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">発言種別</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-8 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs"
          >
            <option value="">すべて</option>
            <option value="question">質問</option>
            <option value="answer">答弁</option>
            <option value="remark">発言</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">都道府県名</label>
          <Input
            type="text"
            placeholder="東京都"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">自治体名</label>
          <Input
            type="text"
            placeholder="千代田区"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">議会レベル</label>
          <select
            value={assemblyLevel}
            onChange={(e) => setAssemblyLevel(e.target.value)}
            className="h-8 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs"
          >
            <option value="">すべて</option>
            <option value="national">国会</option>
            <option value="prefectural">都道府県</option>
            <option value="municipal">市区町村</option>
          </select>
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
