import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { NijimaRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: NijimaRecord = {
      councilId: "92",
      scheduleId: "1",
      councilLabel: "令和6年第1回臨時会",
      scheduleLabel: "01月19日　臨時会",
      heldOn: "2024-01-19",
      meetingType: "extraordinary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: NijimaRecord = {
      councilId: "80",
      scheduleId: "1",
      councilLabel: "令和5年第3回定例会",
      scheduleLabel: "09月10日　本会議",
      heldOn: null,
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });

  it("委員会でも null を返す", async () => {
    const record: NijimaRecord = {
      councilId: "75",
      scheduleId: "1",
      councilLabel: "令和5年予算特別委員会",
      scheduleLabel: "03月15日　予算特別委員会",
      heldOn: "2023-03-15",
      meetingType: "committee",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-003");

    expect(result).toBeNull();
  });
});
