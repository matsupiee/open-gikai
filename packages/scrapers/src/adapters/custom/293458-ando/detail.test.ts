import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第1回定例会 第1日（3月4日）",
        heldOn: "2025-03-04",
        pdfUrl: "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/R6.3.4esturan.pdf",
        meetingType: "plenary",
        articleId: "3757",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("第1回定例会 第1日（3月4日）");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-03-04");
    expect(result.sourceUrl).toBe(
      "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/R6.3.4esturan.pdf",
    );
    expect(result.externalId).toBe("ando_3757_2025-03-04");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第1回臨時会 第1日（4月30日）",
        heldOn: "2024-04-30",
        pdfUrl: "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/R6.4.30.pdf",
        meetingType: "extraordinary",
        articleId: "3757",
      },
      "municipality-id-456",
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("ando_3757_2024-04-30");
  });
});
