import { useState } from "react";
import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";

import { Badge } from "@/shared/_components/ui/badge";
import { Button } from "@/shared/_components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/_components/ui/collapsible";
import { NativeSelect, NativeSelectOption } from "@/shared/_components/ui/native-select";

import { DateWheelPicker } from "./date-wheel-picker";

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

const KIND_LABELS: Record<string, string> = {
  question: "質問",
  answer: "答弁",
};

function formatDateRange(from: string, to: string): string {
  if (from && to) return `${from} ~ ${to}`;
  if (from) return `${from} ~`;
  if (to) return `~ ${to}`;
  return "";
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
  const [isOpen, setIsOpen] = useState(false);
  const hasActiveFilters = !!(kind || heldOnFrom || heldOnTo);
  const hasDateFilter = !!(heldOnFrom || heldOnTo);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="xs" className="gap-1.5 text-muted-foreground">
            <SlidersHorizontalIcon className="size-3.5" />
            詳細条件
            <ChevronDownIcon
              className="size-3 transition-transform duration-200 data-[state=open]:rotate-180"
              data-state={isOpen ? "open" : "closed"}
            />
          </Button>
        </CollapsibleTrigger>

        {hasActiveFilters && (
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {hasDateFilter && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {formatDateRange(heldOnFrom, heldOnTo)}
              </Badge>
            )}
            {kind && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {KIND_LABELS[kind] ?? kind}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onReset}
              aria-label="フィルターをリセット"
              className="text-muted-foreground"
            >
              <XIcon />
            </Button>
          </div>
        )}
      </div>

      <CollapsibleContent>
        <fieldset className="pt-2">
          <legend className="sr-only">検索フィルター</legend>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">開催日</span>
              <DateWheelPicker
                value={heldOnFrom}
                onChange={setHeldOnFrom}
                label="開催日（開始）"
                defaultYear={2021}
                defaultMonth={1}
                defaultDay={1}
              />
              <span className="text-xs text-muted-foreground" aria-hidden="true">
                ~
              </span>
              <DateWheelPicker
                value={heldOnTo}
                onChange={setHeldOnTo}
                label="開催日（終了）"
                defaultYear={new Date().getFullYear()}
                defaultMonth={new Date().getMonth() + 1}
                defaultDay={new Date().getDate()}
              />
            </div>

            <div className="hidden md:block w-px h-6 bg-border shrink-0" aria-hidden="true" />

            <NativeSelect
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="md:w-32"
              aria-label="発言種別"
            >
              <NativeSelectOption value="">すべて</NativeSelectOption>
              <NativeSelectOption value="question">質問</NativeSelectOption>
              <NativeSelectOption value="answer">答弁</NativeSelectOption>
            </NativeSelect>
          </div>

        </fieldset>
      </CollapsibleContent>

      {dateError && (
        <p id="date-error" className="text-xs text-destructive" role="alert">
          {dateError}
        </p>
      )}
    </Collapsible>
  );
}
