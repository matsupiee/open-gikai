import { describe, expect, it } from "vitest";
import { buildMeetingData, parseSpeaker, classifyKind } from "./detail";

describe("buildMeetingData", () => {
  it("detailParams から MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第4回定例会（令和6年11月29日～12月17日） 開会（11月29日）",
        heldOn: "2024-11-29",
        pdfUrl:
          "https://www.town.kusu.oita.jp/material/files/group/18/612kaikaibi.pdf",
        meetingType: "plenary",
        detailPageUrl:
          "https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa3nenkaigiroku_2/5320.html",
      },
      "municipality-id-123",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("municipality-id-123");
    expect(result!.title).toBe(
      "令和6年第4回定例会（令和6年11月29日～12月17日） 開会（11月29日）",
    );
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-11-29");
    expect(result!.sourceUrl).toBe(
      "https://www.town.kusu.oita.jp/material/files/group/18/612kaikaibi.pdf",
    );
    expect(result!.statements).toEqual([]);
  });

  it("臨時会の MeetingData を正しく組み立てる", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第1回臨時会（令和6年1月25日） 開閉会（1月25日）",
        heldOn: "2024-01-25",
        pdfUrl:
          "https://www.town.kusu.oita.jp/material/files/group/18/R61rinnjikai.pdf",
        meetingType: "extraordinary",
        detailPageUrl: "https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa3nenkaigiroku_2/5320.html",
      },
      "municipality-id-456",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.heldOn).toBe("2024-01-25");
  });

  it("heldOn が null の場合は null を返す", () => {
    const result = buildMeetingData(
      {
        title: "令和6年第4回定例会（令和6年11月29日～12月17日） 一般質問表",
        heldOn: null,
        pdfUrl:
          "https://www.town.kusu.oita.jp/material/files/group/18/612ippannsitumonnhyou.pdf",
        meetingType: "plenary",
        detailPageUrl: "https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa3nenkaigiroku_2/5320.html",
      },
      "municipality-id-123",
    );

    expect(result).toBeNull();
  });

  it("externalId が pdfUrl を含む", () => {
    const pdfUrl =
      "https://www.town.kusu.oita.jp/material/files/group/18/612kaikaibi.pdf";
    const result = buildMeetingData(
      {
        title: "令和6年第4回定例会 開会（11月29日）",
        heldOn: "2024-11-29",
        pdfUrl,
        meetingType: "plenary",
        detailPageUrl: "https://example.com",
      },
      "municipality-id-123",
    );

    expect(result!.externalId).toContain("kusu_");
  });
});

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("◯田中議長 ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("◯山田町長 お答えいたします。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("◯鈴木副議長 ご説明いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("◯佐藤副委員長 審議します。");
    expect(result.speakerName).toBe("佐藤");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("審議します。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("◯山本一郎議員 質問いたします。");
    expect(result.speakerName).toBe("山本一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("部長を正しくパースする", () => {
    const result = parseSpeaker("◯田中総務部長 ご報告いたします。");
    expect(result.speakerName).toBe("田中総務");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("◯鈴木副町長 ご説明申し上げます。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("◯マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("◯マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("◯田中太郎 発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("発言します。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});
