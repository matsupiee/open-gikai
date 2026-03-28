import { useCallback, useState } from "react";

export const MUNICIPALITY_CODES_STORAGE_KEY = "open-gikai:selectedMunicipalityCodes";

function loadMunicipalityCodes(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(MUNICIPALITY_CODES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveMunicipalityCodes(codes: string[]) {
  try {
    localStorage.setItem(MUNICIPALITY_CODES_STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // ignore
  }
}

export function usePersistedMunicipalityCodes() {
  const [municipalityCodes, setMunicipalityCodesState] = useState<string[]>(loadMunicipalityCodes);

  const setMunicipalityCodes = useCallback((codes: string[]) => {
    setMunicipalityCodesState(codes);
    saveMunicipalityCodes(codes);
  }, []);

  return { municipalityCodes, setMunicipalityCodes };
}
