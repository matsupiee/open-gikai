import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";

import { orpc } from "@/lib/orpc/orpc";
import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";
import { useDebouncedValue } from "@/shared/_hooks/use-debounced-value";

interface MunicipalitySelectorProps {
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
}

export function MunicipalitySelector({ selectedCodes, onChange }: MunicipalitySelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data } = useQuery({
    ...orpc.municipalities.list.queryOptions({
      input: {
        query: debouncedSearch || undefined,
        limit: 50,
        sortBy: "code",
      },
    }),
  });

  const municipalities = data?.municipalities ?? [];

  const { data: selectedData } = useQuery({
    ...orpc.municipalities.list.queryOptions({
      input: {
        codes: selectedCodes,
        limit: 100,
        sortBy: "code",
      },
    }),
    enabled: selectedCodes.length > 0,
  });

  const selectedNames = useMemo(() => {
    const map = new Map<string, string>();
    const allMunicipalities = [
      ...(data?.municipalities ?? []),
      ...(selectedData?.municipalities ?? []),
    ];
    for (const m of allMunicipalities) {
      if (selectedCodes.includes(m.code)) {
        map.set(m.code, `${m.prefecture} ${m.name}`);
      }
    }
    return map;
  }, [data, selectedData, selectedCodes]);

  const toggleCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter((c) => c !== code));
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  const removeCode = (code: string) => {
    onChange(selectedCodes.filter((c) => c !== code));
  };

  const listboxId = "municipality-listbox";

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby="municipality-label">
      <Label id="municipality-label" className="text-sm font-semibold">
        自治体を選択 <span aria-hidden="true" className="text-destructive">*</span>
        <span className="sr-only">（必須）</span>
      </Label>

      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="選択中の自治体">
          {selectedCodes.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1 pr-1">
              {selectedNames.get(code) ?? code}
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`${selectedNames.get(code) ?? code}を解除`}
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onChange([])}
          >
            すべて解除
          </Button>
        </div>
      )}

      <div className="relative">
        <Input
          type="text"
          placeholder="検索したい自治体名を入力してください"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="text-sm"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label="自治体を検索"
        />

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <ul
              id={listboxId}
              role="listbox"
              aria-label="自治体一覧"
              className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded border border-border bg-popover shadow-md"
            >
              {municipalities.length === 0 && (
                <li className="px-3 py-2 text-xs text-muted-foreground" role="option" aria-selected={false} aria-disabled="true">
                  {search ? "該当する自治体が見つかりません" : "読み込み中..."}
                </li>
              )}
              {municipalities.map((m) => {
                const isSelected = selectedCodes.includes(m.code);
                return (
                  <li
                    key={m.code}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent ${
                        isSelected ? "bg-accent/50 font-medium" : ""
                      }`}
                      onClick={() => toggleCode(m.code)}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <svg
                            className="size-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span>
                        {m.prefecture} {m.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {selectedCodes.length === 0 && (
        <p className="text-xs text-muted-foreground" role="status">
          検索するには、少なくとも1つの自治体を選択してください
        </p>
      )}
    </div>
  );
}
