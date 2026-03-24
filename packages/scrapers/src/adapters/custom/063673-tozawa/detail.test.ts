import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { TozawaRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: TozawaRecord = {
      councilId: "48",
      scheduleId: "1",
      councilLabel: "令和6年第1回臨時会",
      scheduleLabel: "01月23日　本会議",
      heldOn: "2024-01-23",
      meetingType: "extraordinary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: TozawaRecord = {
      councilId: "50",
      scheduleId: "1",
      councilLabel: "令和6年第1回定例会",
      scheduleLabel: "03月07日　本会議",
      heldOn: null,
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
