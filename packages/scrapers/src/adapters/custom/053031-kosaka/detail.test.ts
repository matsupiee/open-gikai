import { describe, expect, it } from "vitest";
import { buildMeetingData } from "./detail";

describe("buildMeetingData", () => {
  it("定例会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第1回小坂町議会（定例会） 初日（2月20日）",
        heldOn: "2024-02-20",
        pdfUrl: "https://www.town.kosaka.akita.jp/material/files/group/5/R6-1syoniti.pdf",
        meetingType: "plenary",
        detailUrl: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html",
        pdfLabel: "初日（2月20日）",
      },
      "municipality-id-123"
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("municipality-id-123");
    expect(result!.title).toBe("令和6年第1回小坂町議会（定例会） 初日（2月20日）");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-02-20");
    expect(result!.sourceUrl).toBe("https://www.town.kosaka.akita.jp/material/files/group/5/R6-1syoniti.pdf");
    expect(result!.externalId).toContain("kosaka_");
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第5回小坂町議会（臨時会） 7月29日",
        heldOn: "2024-07-29",
        pdfUrl: "https://www.town.kosaka.akita.jp/material/files/group/5/R605rinnjikai.pdf",
        meetingType: "extraordinary",
        detailUrl: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2549.html",
        pdfLabel: "7月29日",
      },
      "municipality-id-456"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.heldOn).toBe("2024-07-29");
  });

  it("heldOn が null の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "令和7年第2回小坂町議会（定例会） 一般質問",
        heldOn: null,
        pdfUrl: "https://www.town.kosaka.akita.jp/material/files/group/5/R0702teireikaiippannshitsumonn.pdf",
        meetingType: "plenary",
        detailUrl: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_6/2795.html",
        pdfLabel: "一般質問",
      },
      "municipality-id-789"
    );

    expect(result).toBeNull();
  });

  it("externalId に detailUrl と pdfLabel が含まれる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第1回小坂町議会（定例会） 初日（2月20日）",
        heldOn: "2024-02-20",
        pdfUrl: "https://www.town.kosaka.akita.jp/material/files/group/5/R6-1syoniti.pdf",
        meetingType: "plenary",
        detailUrl: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html",
        pdfLabel: "初日（2月20日）",
      },
      "municipality-id-123"
    );

    expect(result!.externalId).toMatch(/^kosaka_/);
  });

  it("statements が空配列", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第1回小坂町議会（定例会） 初日（2月20日）",
        heldOn: "2024-02-20",
        pdfUrl: "https://www.town.kosaka.akita.jp/material/files/group/5/R6-1syoniti.pdf",
        meetingType: "plenary",
        detailUrl: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html",
        pdfLabel: "初日（2月20日）",
      },
      "municipality-id-123"
    );

    expect(result!.statements).toEqual([]);
  });
});
