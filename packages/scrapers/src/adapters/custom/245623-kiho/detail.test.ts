import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("テキスト会議録が存在しないため常に null を返す", async () => {
    const result = await fetchMeetingData({}, "245623");
    expect(result).toBeNull();
  });

  it("detailParams に値があっても null を返す", async () => {
    const result = await fetchMeetingData(
      { title: "令和6年第1回定例会", heldOn: "2024-03-01" },
      "245623",
    );
    expect(result).toBeNull();
  });
});
