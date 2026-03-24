import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, fetchMeetingData } from "./detail";

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
    const result = parseSpeaker("◯鈴木副議長 ご報告いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("ご報告いたします。");
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
    const result = parseSpeaker("◯田中総務部長 ご説明いたします。");
    expect(result.speakerName).toBe("田中総務");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("◯佐々木企画課長 ご報告いたします。");
    expect(result.speakerName).toBe("佐々木企画");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("◯高橋副町長 ただいまより説明します。");
    expect(result.speakerName).toBe("高橋");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ただいまより説明します。");
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

describe("parseStatements", () => {
  it("◯マーカーで発言ブロックを分割する", () => {
    const text = `
◯田中議長　ただいまから本日の会議を開きます。
◯山本一郎議員　質問いたします。
◯山田町長　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("田中");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("山本一郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("登壇ト書きをスキップする", () => {
    const text = `◯田中議長　ただいまから会議を開きます。
◯（登壇）
◯山本一郎議員　質問いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("contentHash が生成される", () => {
    const text = `◯田中議長　ただいまから会議を開きます。`;
    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `◯田中議長　ただいま。◯山本一郎議員　質問です。`;
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("◯マーカーがないブロックはスキップする", () => {
    const text = `これは通常テキストです。
◯田中議長　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});

describe("fetchMeetingData", () => {
  it("heldOn が null の場合は null を返す", async () => {
    const result = await fetchMeetingData(
      {
        title: "令和6年度 第1回御船町議会定例会（6月会議）",
        heldOn: null,
        pdfUrl: "https://www.town.mifune.kumamoto.jp/common/UploadFileOutput.ashx?c_id=3&id=8722&sub_id=1&flid=101",
        meetingType: "plenary",
      },
      "municipality-id-123"
    );

    expect(result).toBeNull();
  });
});
