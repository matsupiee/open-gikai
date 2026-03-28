import { useCallback, useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/shared/_components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/_components/ui/drawer";
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from "@/shared/_components/wheel-picker";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildYearOptions(from: number, to: number): WheelPickerOption<number>[] {
  const options: WheelPickerOption<number>[] = [];
  for (let y = from; y <= to; y++) {
    options.push({ label: `${y}年`, value: y });
  }
  return options;
}

function buildMonthOptions(): WheelPickerOption<number>[] {
  return Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}月`,
    value: i + 1,
  }));
}

function buildDayOptions(daysInMonth: number): WheelPickerOption<number>[] {
  return Array.from({ length: daysInMonth }, (_, i) => ({
    label: `${i + 1}日`,
    value: i + 1,
  }));
}

function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return "";
  return `${parsed.year}/${parsed.month}/${parsed.day}`;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2030;

const YEAR_OPTIONS = buildYearOptions(MIN_YEAR, MAX_YEAR);
const MONTH_OPTIONS = buildMonthOptions();

interface DateWheelPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  defaultYear: number;
  defaultMonth: number;
  defaultDay: number;
}

export function DateWheelPicker({
  value,
  onChange,
  label,
  defaultYear,
  defaultMonth,
  defaultDay,
}: DateWheelPickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = parseDate(value);
  const [year, setYear] = useState(parsed?.year ?? defaultYear);
  const [month, setMonth] = useState(parsed?.month ?? defaultMonth);
  const [day, setDay] = useState(parsed?.day ?? defaultDay);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const dayOptions = useMemo(() => buildDayOptions(daysInMonth), [daysInMonth]);

  const clampedDay = Math.min(day, daysInMonth);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Reset to current value or defaults when opening
        const p = parseDate(value);
        setYear(p?.year ?? defaultYear);
        setMonth(p?.month ?? defaultMonth);
        setDay(p?.day ?? defaultDay);
      }
      setOpen(isOpen);
    },
    [value, defaultYear, defaultMonth, defaultDay],
  );

  const handleConfirm = useCallback(() => {
    const d = Math.min(day, getDaysInMonth(year, month));
    onChange(formatDate(year, month, d));
    setOpen(false);
  }, [year, month, day, onChange]);

  const handleClear = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} handleOnly>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs min-w-0 flex-1 text-left hover:bg-accent/50 transition-colors"
          aria-label={label}
        >
          <CalendarIcon className="size-3 text-muted-foreground shrink-0" />
          {value ? (
            <span className="truncate">{formatDisplayDate(value)}</span>
          ) : (
            <span className="text-muted-foreground truncate">未設定</span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-[480px]">
          <DrawerHeader className="relative">
            <DrawerTitle className="text-sm">{label}</DrawerTitle>
            {value && (
              <Button
                variant="link"
                size="sm"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground h-auto p-0"
                onClick={handleClear}
              >
                クリア
              </Button>
            )}
          </DrawerHeader>
          <div className="flex justify-center px-4 pb-2">
            <WheelPickerWrapper className="w-full max-w-xs">
              <WheelPicker
                options={YEAR_OPTIONS}
                value={year}
                onValueChange={(v) => setYear(v)}
              />
              <WheelPicker
                options={MONTH_OPTIONS}
                value={month}
                onValueChange={(v) => setMonth(v)}
              />
              <WheelPicker
                options={dayOptions}
                value={clampedDay}
                onValueChange={(v) => setDay(v)}
              />
            </WheelPickerWrapper>
          </div>
          <DrawerFooter className="flex-row gap-2">
            <DrawerClose asChild>
              <Button variant="outline" size="sm" className="flex-1">
                キャンセル
              </Button>
            </DrawerClose>
            <Button size="sm" className="flex-1" onClick={handleConfirm}>
              決定
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
