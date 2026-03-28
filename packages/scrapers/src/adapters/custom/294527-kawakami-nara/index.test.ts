import { describe, expect, it } from "vitest";
import { adapter } from "./index";

describe("294527-kawakami-nara adapter", () => {
  it("name が 294527 である", () => {
    expect(adapter.name).toBe("294527");
  });

  it("fetchList は常に空配列を返す（会議録データなし）", async () => {
    const result = await adapter.fetchList({
      baseUrl: "https://www.vill.kawakami.nara.jp/",
      year: 2024,
    });
    expect(result).toEqual([]);
  });

  it("fetchDetail は null を返す（呼ばれることはないが念のため）", async () => {
    const result = await adapter.fetchDetail({
      detailParams: {},
      municipalityCode: "294527",
    });
    expect(result).toBeNull();
  });
});
