import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("〇松島茂喜議長 ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("松島茂喜");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("〇橋本光規町長 お答えいたします。");
    expect(result.speakerName).toBe("橋本光規");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("〇田中一郎副町長 ご説明いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("〇小林淳一教育長 ご報告いたします。");
    expect(result.speakerName).toBe("小林淳一");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("番号付き議員を正しくパースする（半角数字）", () => {
    const result = parseSpeaker("〇14番　松村　潤議員 一般質問いたします。");
    expect(result.speakerName).toBe("松村潤");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("番号付き議員を正しくパースする（全角数字）", () => {
    const result = parseSpeaker("〇１番　山本裕子議員 質問いたします。");
    expect(result.speakerName).toBe("山本裕子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長を正しくパースする（学校教育課長）", () => {
    const result = parseSpeaker("〇川島隆史学校教育課長 ご説明いたします。");
    expect(result.speakerName).toBe("川島隆史学校教育");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長を正しくパースする（委員長より先にマッチ）", () => {
    const result = parseSpeaker("〇鈴木二郎副委員長 審議いたします。");
    expect(result.speakerName).toBe("鈴木二郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("審議いたします。");
  });

  it("会計管理者を正しくパースする", () => {
    const result = parseSpeaker("〇高橋三郎会計管理者 ご報告いたします。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("会計管理者");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("○ マーカー（丸）でも正しく処理する", () => {
    const result = parseSpeaker("○松島茂喜議長 ただいまから会議を開きます。");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
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

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("学校教育課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("学校教育課長")).toBe("answer");
  });

  it("会計管理者は answer", () => {
    expect(classifyKind("会計管理者")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("〇 マーカーで発言を分割して抽出する", () => {
    const text = [
      "〇松島茂喜議長 ただいまから本日の会議を開きます。",
      "〇14番　松村　潤議員 一般質問いたします。",
      "〇橋本光規町長 お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("松島茂喜");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("松村潤");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("橋本光規");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("◎ セクション見出しをスキップする", () => {
    const text = [
      "◎開議の宣告",
      "〇松島茂喜議長 ただいまから会議を開きます。",
      "◎一般質問",
      "〇14番　松村　潤議員 質問いたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("ページ番号行（- 15 -）を除去する", () => {
    const text = [
      "〇松島茂喜議長 ただいまから会議を開きます。",
      "- 15 -",
      "〇14番　松村　潤議員 質問いたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.content).toBe("質問いたします。");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = "〇松島茂喜議長 ただいまから会議を開きます。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "〇議長 ただいま。\n〇議員 質問です。";

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言内容が空のブロックはスキップする", () => {
    const text = "〇松島茂喜議長\n〇14番　松村　潤議員 質問します。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "議事日程\n第1号 開会\n第2号 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = [
      "〇松島茂喜議長 ただいまから",
      "本日の会議を",
      "開きます。",
      "〇14番　松村　潤議員 質問します。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("本日の会議を");
    expect(statements[0]!.content).toContain("開きます。");
  });
});
