import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("会議録提供がないため常に null を返す", async () => {
    const result = await fetchMeetingData({}, "294535");
    expect(result).toBeNull();
  });

  it("detailParams に値があっても null を返す", async () => {
    const result = await fetchMeetingData(
      { title: "令和6年第1回定例会", heldOn: "2024-03-01" },
      "294535",
    );
    expect(result).toBeNull();
  });
});
