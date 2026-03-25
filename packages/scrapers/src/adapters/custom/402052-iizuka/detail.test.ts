import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第2回定例会 6月12日（第1号）",
        heldOn: "2024-06-12",
        pdfUrl: "https://www.city.iizuka.lg.jp/uploaded/attachment/9082.pdf",
        meetingType: "plenary",
        pageId: "2360",
      },
      "municipality-id-123"
    );

    expect(result.municipalityCode).toBe("municipality-id-123");
    expect(result.title).toBe("第2回定例会 6月12日（第1号）");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2024-06-12");
    expect(result.sourceUrl).toBe(
      "https://www.city.iizuka.lg.jp/uploaded/attachment/9082.pdf"
    );
    expect(result.externalId).toBe("iizuka_2360_2024-06-12");
    expect(result.statements).toEqual([]);
  });

  it("委員会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "総務委員会 3月13日（第1号）",
        heldOn: "2026-03-13",
        pdfUrl: "https://www.city.iizuka.lg.jp/uploaded/attachment/1234.pdf",
        meetingType: "committee",
        pageId: "1234",
      },
      "municipality-id-456"
    );

    expect(result.meetingType).toBe("committee");
    expect(result.externalId).toBe("iizuka_1234_2026-03-13");
  });
});
