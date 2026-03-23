import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第1回定例会本会議 第1日",
        heldOn: "2020-03-09",
        pdfUrl:
          "https://www.akaigawa.com/manage/wp-content/themes/akaigawa/asset/file/kurashi/gyosei/meeting.pdf",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("第1回定例会本会議 第1日");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("2020-03-09");
    expect(result.sourceUrl).toBe(
      "https://www.akaigawa.com/manage/wp-content/themes/akaigawa/asset/file/kurashi/gyosei/meeting.pdf"
    );
    expect(result.externalId).toBe("akaigawa_2020-03-09");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第2回臨時会本会議 第1日",
        heldOn: "2022-03-25",
        pdfUrl:
          "https://www.akaigawa.com/manage/wp-content/uploads/2022/11/hash.pdf",
        meetingType: "extraordinary",
      },
      "municipality-id-456"
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("akaigawa_2022-03-25");
    expect(result.sourceUrl).toBe(
      "https://www.akaigawa.com/manage/wp-content/uploads/2022/11/hash.pdf"
    );
  });
});
