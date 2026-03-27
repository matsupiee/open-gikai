import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("通常議会の会議録が未公開のため常に null を返す", async () => {
    const result = await fetchMeetingData({}, "193640");
    expect(result).toBeNull();
  });

  it("任意の detailParams を渡しても null を返す", async () => {
    const result = await fetchMeetingData(
      { title: "令和7年第1回定例会", sourceUrl: "https://example.com/mock.pdf" },
      "193640",
    );
    expect(result).toBeNull();
  });
});
