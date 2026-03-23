import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第4回定例会 11月25日",
        heldOn: "2025-11-25",
        pdfUrl: "https://www.city.awa.lg.jp/gikai/docs/2026022700023/file_contents/kaigiroku071125.pdf",
        meetingType: "plenary",
        pageId: "2026022700023",
      },
      "municipality-id-123"
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("令和7年第4回定例会 11月25日");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-11-25");
    expect(result.sourceUrl).toBe(
      "https://www.city.awa.lg.jp/gikai/docs/2026022700023/file_contents/kaigiroku071125.pdf"
    );
    expect(result.externalId).toBe("awa_2026022700023_2025-11-25");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第1回臨時会 5月7日",
        heldOn: "2025-05-07",
        pdfUrl: "https://www.city.awa.lg.jp/gikai/docs/2025112600014/file_contents/kaigiroku070507.pdf",
        meetingType: "extraordinary",
        pageId: "2025112600014",
      },
      "municipality-id-456"
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("awa_2025112600014_2025-05-07");
  });
});
