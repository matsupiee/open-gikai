import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第1回定例会（2月25日～3月18日）",
        heldOn: "2025-02-25",
        pdfUrl:
          "https://www.town.ami.lg.jp/cmsfiles/contents/0000000/309/R0703_T1.pdf",
        meetingType: "plenary",
        fileName: "R0703_T1.pdf",
      },
      "municipality-id-123"
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("第1回定例会（2月25日～3月18日）");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2025-02-25");
    expect(result.sourceUrl).toBe(
      "https://www.town.ami.lg.jp/cmsfiles/contents/0000000/309/R0703_T1.pdf"
    );
    expect(result.externalId).toBe("ami_R0703_T1_2025-02-25");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第1回臨時会（2月4日）",
        heldOn: "2025-02-04",
        pdfUrl:
          "https://www.town.ami.lg.jp/cmsfiles/contents/0000000/309/R0702_R1.pdf",
        meetingType: "extraordinary",
        fileName: "R0702_R1.pdf",
      },
      "municipality-id-456"
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("ami_R0702_R1_2025-02-04");
  });

  it("特別委員会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "予算決算特別委員会（3月5日～3月7日）",
        heldOn: "2025-03-05",
        pdfUrl:
          "https://www.town.ami.lg.jp/cmsfiles/contents/0000000/309/R0703_T1_toku.pdf",
        meetingType: "committee",
        fileName: "R0703_T1_toku.pdf",
      },
      "municipality-id-789"
    );

    expect(result.meetingType).toBe("committee");
    expect(result.externalId).toBe("ami_R0703_T1_toku_2025-03-05");
  });
});
