import { describe, test, expect } from "vitest";
import { parseMunicipalitiesCsvContent } from "./parse-municipalities-csv";

describe("parseMunicipalitiesCsvContent", () => {
  test("ヘッダー行をスキップしてデータ行をパースする", () => {
    const csv = [
      "code,prefecture,name,col3,col4,baseUrl,population,populationYear",
      '011002,"北海道","札幌市",,,"https://example.com","1970000","2024"',
    ].join("\n");

    const rows = parseMunicipalitiesCsvContent(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      code: "011002",
      name: "札幌市",
      prefecture: "北海道",
      baseUrl: "https://example.com",
      population: 1970000,
      populationYear: 2024,
    });
  });

  test("空行はスキップする", () => {
    const csv = "header\n011002,北海道,札幌市,,,,,\n\n";
    const rows = parseMunicipalitiesCsvContent(csv);
    expect(rows).toHaveLength(1);
  });

  test("baseUrl が空なら null になる", () => {
    const csv = "header\n011002,北海道,札幌市,,,,1000,2024";
    const rows = parseMunicipalitiesCsvContent(csv);
    expect(rows[0]!.baseUrl).toBeNull();
  });

  test("population が空なら null になる", () => {
    const csv = "header\n011002,北海道,札幌市,,,https://example.com,,";
    const rows = parseMunicipalitiesCsvContent(csv);
    expect(rows[0]!.population).toBeNull();
    expect(rows[0]!.populationYear).toBeNull();
  });

  test("name が空なら prefecture がフォールバックされる", () => {
    const csv = "header\n011002,北海道,,,,,,";
    const rows = parseMunicipalitiesCsvContent(csv);
    expect(rows[0]!.name).toBe("北海道");
  });
});
