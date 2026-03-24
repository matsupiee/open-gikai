import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("会議録が公開されていないため常に null を返す", async () => {
    const result = await fetchMeetingData({}, "363421");
    expect(result).toBeNull();
  });

  it("任意の detailParams を渡しても null を返す", async () => {
    const result = await fetchMeetingData(
      { title: "令和6年第3回定例会", heldOn: "2024-09-10" },
      "363421",
    );
    expect(result).toBeNull();
  });
});
