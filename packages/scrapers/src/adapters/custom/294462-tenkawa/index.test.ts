import { describe, expect, it } from "vitest";
import { adapter } from "./index";

describe("294462-tenkawa adapter", () => {
  it("name が 294462 である", () => {
    expect(adapter.name).toBe("294462");
  });

  it("fetchList は常に空配列を返す（テキスト会議録なし）", async () => {
    const result = await adapter.fetchList({
      baseUrl:
        "https://smart.discussvision.net/smart/tenant/nara/WebView/rd/council_1.html",
      year: 2024,
    });
    expect(result).toEqual([]);
  });

  it("fetchDetail は null を返す（呼ばれることはないが念のため）", async () => {
    const result = await adapter.fetchDetail({
      detailParams: {},
      municipalityId: "294462",
    });
    expect(result).toBeNull();
  });
});
