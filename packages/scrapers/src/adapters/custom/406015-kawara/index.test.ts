import { describe, expect, it } from "vitest";
import { adapter } from "./index";

describe("406015-kawara adapter", () => {
  it("name が 406015 である", () => {
    expect(adapter.name).toBe("406015");
  });

  it("fetchList は常に空配列を返す（会議録本文なし）", async () => {
    const result = await adapter.fetchList({
      baseUrl: "https://www.town.kawara.fukuoka.jp/110/",
      year: 2025,
    });

    expect(result).toEqual([]);
  });

  it("fetchDetail は null を返す", async () => {
    const result = await adapter.fetchDetail({
      detailParams: {},
      municipalityCode: "406015",
    });

    expect(result).toBeNull();
  });
});
