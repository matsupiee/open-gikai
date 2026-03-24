import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";
import type { NakatosaRecord } from "./list";

describe("fetchMeetingData", () => {
  it("テキスト会議録がないため常に null を返す", async () => {
    const record: NakatosaRecord = {
      councilId: "72",
      scheduleId: "1",
      councilLabel: "令和7年3月定例会（通常会議）",
      scheduleLabel: "3月10日　本会議",
      heldOn: "2025-03-10",
      meetingType: "plenary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/nakatosa/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-001");

    expect(result).toBeNull();
  });

  it("heldOn が null でも null を返す（エラーにならない）", async () => {
    const record: NakatosaRecord = {
      councilId: "65",
      scheduleId: "1",
      councilLabel: "令和6年12月定例会（第1回臨時会議）",
      scheduleLabel: "12月01日",
      heldOn: null,
      meetingType: "extraordinary",
      sourceUrl:
        "https://smart.discussvision.net/smart/tenant/nakatosa/WebView/rd/council_1.html",
    };

    const result = await fetchMeetingData(record, "municipality-id-002");

    expect(result).toBeNull();
  });
});
