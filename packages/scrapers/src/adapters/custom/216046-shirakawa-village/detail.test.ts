import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("発言全文の会議録が公開されていないため null を返す", async () => {
    const result = await fetchMeetingData(
      {
        pdfUrl: "https://www.vill.shirakawa.lg.jp/secure/1234/R7_1_teirei_ippan.pdf",
        linkText: "令和7年第1回定例会 一般質問通告",
        kind: "ippan",
        year: 2025,
        heldOn: null,
        title: "令和7年第1回定例会 一般質問通告",
        meetingType: "plenary",
      },
      "municipality-id-dummy"
    );

    expect(result).toBeNull();
  });

  it("議会だよりでも null を返す", async () => {
    const result = await fetchMeetingData(
      {
        pdfUrl: "https://www.vill.shirakawa.lg.jp/secure/9999/gikai_52.pdf",
        linkText: "しらかわ議会だより第52号（令和8年1月）",
        kind: "gikai",
        year: 2026,
        heldOn: null,
        title: "しらかわ議会だより第52号（令和8年1月）",
        meetingType: "plenary",
      },
      "municipality-id-dummy"
    );

    expect(result).toBeNull();
  });
});
