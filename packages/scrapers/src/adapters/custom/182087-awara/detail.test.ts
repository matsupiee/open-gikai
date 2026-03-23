import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第120回 3月定例会",
        pdfUrl:
          "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/120kaigiroku.pdf",
        meetingType: "plenary",
        pagePath: "/gikai/kaigiroku/p014488.html",
      },
      "municipality-id-123",
    );

    expect(result.municipalityId).toBe("municipality-id-123");
    expect(result.title).toBe("第120回 3月定例会");
    expect(result.meetingType).toBe("plenary");
    expect(result.heldOn).toBe("");
    expect(result.sourceUrl).toBe(
      "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/120kaigiroku.pdf",
    );
    expect(result.externalId).toBe("awara_p014488_120kaigiroku");
    expect(result.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "第121回 4月臨時会",
        pdfUrl:
          "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/121kaigiroku.pdf",
        meetingType: "extraordinary",
        pagePath: "/gikai/kaigiroku/p014488.html",
      },
      "municipality-id-456",
    );

    expect(result.meetingType).toBe("extraordinary");
    expect(result.externalId).toBe("awara_p014488_121kaigiroku");
  });

  it("平成27〜30年形式の externalId を正しく生成する", () => {
    const result = buildMeetingData(
      {
        title: "第94回 3月定例会",
        pdfUrl:
          "https://www.city.awara.lg.jp/gikai/kaigiroku/30kaigiroku_d/fil/1.pdf",
        meetingType: "plenary",
        pagePath: "/gikai/kaigiroku/30kaigiroku.html",
      },
      "municipality-id-789",
    );

    expect(result.externalId).toBe("awara_30kaigiroku_1");
  });

  it("旧平成系の externalId を正しく生成する", () => {
    const result = buildMeetingData(
      {
        title: "第1回 3月定例会",
        pdfUrl:
          "https://www.city.awara.lg.jp/gikai/kaigiroku/p000958_d/fil/001.pdf",
        meetingType: "plenary",
        pagePath: "/gikai/kaigiroku/p000958.html",
      },
      "municipality-id-000",
    );

    expect(result.externalId).toBe("awara_p000958_001");
  });
});
