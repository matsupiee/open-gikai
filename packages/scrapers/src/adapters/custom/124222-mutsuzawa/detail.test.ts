import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { MutsuzawaRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: MutsuzawaRecord = {
      councilId: "14",
      scheduleId: "1",
      councilLabel: "令和6年第1回臨時会",
      scheduleLabel: "01月22日　本会議",
      heldOn: "2024-01-22",
      meetingType: "extraordinary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: MutsuzawaRecord = {
      councilId: "10",
      scheduleId: "1",
      councilLabel: "令和5年第3回定例会",
      scheduleLabel: "09月10日　本会議",
      heldOn: null,
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
