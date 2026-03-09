import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";

interface FilterFormProps {
  assemblyLevel: string;
  setAssemblyLevel: (v: string) => void;
  prefecture: string;
  setPrefecture: (v: string) => void;
  municipality: string;
  setMunicipality: (v: string) => void;
  heldOnFrom: string;
  setHeldOnFrom: (v: string) => void;
  heldOnTo: string;
  setHeldOnTo: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

export function FilterForm({
  assemblyLevel,
  setAssemblyLevel,
  prefecture,
  setPrefecture,
  municipality,
  setMunicipality,
  heldOnFrom,
  setHeldOnFrom,
  heldOnTo,
  setHeldOnTo,
  onSearch,
  onReset,
}: FilterFormProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">フィルター</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="assembly-level">議会レベル</Label>
            <select
              id="assembly-level"
              value={assemblyLevel}
              onChange={(e) => setAssemblyLevel(e.target.value)}
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            >
              <option value="">すべて</option>
              <option value="national">国会 (national)</option>
              <option value="prefectural">都道府県 (prefectural)</option>
              <option value="municipal">市区町村 (municipal)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prefecture">都道府県</Label>
            <Input
              id="prefecture"
              type="text"
              placeholder="例: 東京都"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="municipality">自治体名</Label>
            <Input
              id="municipality"
              type="text"
              placeholder="例: 渋谷区"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="held-on-from">開催日（から）</Label>
            <Input
              id="held-on-from"
              type="date"
              value={heldOnFrom}
              onChange={(e) => setHeldOnFrom(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="held-on-to">開催日（まで）</Label>
            <Input
              id="held-on-to"
              type="date"
              value={heldOnTo}
              onChange={(e) => setHeldOnTo(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onSearch} variant="default">
            検索
          </Button>
          <Button onClick={onReset} variant="outline">
            リセット
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
