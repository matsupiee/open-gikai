import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（上岡 義茂議員） ただいまから会議を開きます。");
    expect(result.speakerName).toBe("上岡義茂");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（森田 弘光君） お答えいたします。");
    expect(result.speakerName).toBe("森田弘光");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○６番（奥 好生議員） 一般質問いたします。");
    expect(result.speakerName).toBe("奥好生");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("課長補佐を正しくパースする", () => {
    const result = parseSpeaker("○総務課長補佐（宇都 克俊君） ご説明いたします。");
    expect(result.speakerName).toBe("宇都克俊");
    expect(result.speakerRole).toBe("課長補佐");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("スペース区切りの氏名 + 部署役職を正しくパースする", () => {
    const result = parseSpeaker("○森田 博二企画財政課長 お答えいたします。");
    expect(result.speakerName).toBe("森田博二");
    expect(result.speakerRole).toBe("企画財政課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("複合役職も正しくパースする", () => {
    const result = parseSpeaker("○中原 智浩農地整備課長補佐兼係長 お答えいたします。");
    expect(result.speakerName).toBe("中原智浩");
    expect(result.speakerRole).toBe("農地整備課長補佐兼係長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○マーカーなしは role なしで返す", () => {
    const result = parseSpeaker("午後1時より再開します。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後1時より再開します。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("role 不明は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("日程見出しを飛ばして実際の発言だけを抽出する", () => {
    const text = `
○日程第１ 会議録署名議員の指名
○議長（上岡 義茂議員） ただいまから本日の会議を開きます。 △ 日程第１ 会議録署名議員の指名
○６番（奥 好生議員） 一般質問いたします。
○町長（森田 弘光君） お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");
    expect(statements[1]!.speakerName).toBe("奥好生");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("スペース区切りの氏名 + 部署役職を answer として扱う", () => {
    const text = "○森田 博二企画財政課長 お答えいたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("森田博二");
    expect(statements[0]!.speakerRole).toBe("企画財政課長");
    expect(statements[0]!.kind).toBe("answer");
  });

  it("追加日程の見出しもスキップする", () => {
    const text = `
○追加日程第１ 特別委員会委員の辞任について
○議長（上岡 義茂議員） 本件についてお諮りします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("ト書きをスキップする", () => {
    const text = `
○６番（奥 好生議員）（登壇）
○６番（奥 好生議員） 再質問いたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("再質問いたします。");
  });

  it("contentHash が SHA-256 の hex 文字列になる", () => {
    const text = "○議長（上岡 義茂議員） 休憩前に引き続き会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset を順番に計算する", () => {
    const text = `
○議長（上岡 義茂議員） ただいま。
○町長（森田 弘光君） お答えします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});
