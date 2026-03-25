import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseSpeakerLabel,
  parsePdfText,
  extractHeldOnFromText,
  extractTitleFromText,
} from "./detail";

describe("classifyKind", () => {
  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

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

  it("総務課長は answer（サフィックスで判定）", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("番号議員（２番）は question", () => {
    expect(classifyKind("２番")).toBe("question");
  });
});

describe("parseSpeakerLabel", () => {
  it("議長（後藤篤人君）形式をパースする", () => {
    const result = parseSpeakerLabel("議長（後藤篤人君）");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("後藤篤人");
  });

  it("町長（松村　論君）形式をパースする（全角スペースを含む氏名）", () => {
    const result = parseSpeakerLabel("町長（松村　論君）");
    expect(result.speakerRole).toBe("町長");
    // parseSpeakerLabel はラベル全体を正規化するため全角スペースは除去される
    expect(result.speakerName).toBe("松村論");
  });

  it("○２番（加藤重夫君）形式をパースする", () => {
    const result = parseSpeakerLabel("２番（加藤重夫君）");
    expect(result.speakerRole).toBe("２番");
    expect(result.speakerName).toBe("加藤重夫");
  });

  it("教育長（石井　洋君）形式をパースする", () => {
    const result = parseSpeakerLabel("教育長（石井　洋君）");
    expect(result.speakerRole).toBe("教育長");
    // parseSpeakerLabel はラベル全体を正規化するため全角スペースは除去される
    expect(result.speakerName).toBe("石井洋");
  });

  it("総務課長（河合髙弘君）形式をパースする", () => {
    const result = parseSpeakerLabel("総務課長（河合髙弘君）");
    expect(result.speakerRole).toBe("課長");
    expect(result.speakerName).toBe("河合髙弘");
  });

  it("副委員長は副委員長として認識する（委員長より先にマッチ）", () => {
    const result = parseSpeakerLabel("副委員長（田中一郎君）");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.speakerName).toBe("田中一郎");
  });
});

describe("parsePdfText", () => {
  it("PDF テキストから発言を抽出する", () => {
    const text = `
令和７年由仁町議会第１回定例会　第１号

令和７年３月４日（火）

○議長（後藤篤人君） ただいまから開会します。
○町長（松村　論君） 提案理由を説明いたします。
○２番（加藤重夫君） 質問いたします。
    `;

    const statements = parsePdfText(text);
    expect(statements.length).toBeGreaterThanOrEqual(3);

    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("後藤篤人");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから開会します。");

    expect(statements[1]!.speakerRole).toBe("町長");
    // normalizeSpacedName が全角スペースを除去するため "松村論" になる
    expect(statements[1]!.speakerName).toBe("松村論");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerRole).toBe("２番");
    expect(statements[2]!.kind).toBe("question");
  });

  it("◎ 議事進行行はスキップする", () => {
    const text = `
◎開会の宣告
○議長（後藤篤人君） 開会します。
◎日程第１　会議録署名議員の指名
○議長（後藤篤人君） 署名議員を指名します。
    `;

    const statements = parsePdfText(text);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    for (const stmt of statements) {
      expect(stmt.speakerRole).toBe("議長");
    }
  });

  it("contentHash が生成される", () => {
    const text = `○議長（後藤篤人君） ただいまから会議を開きます。`;
    const statements = parsePdfText(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `
○議長（後藤篤人君） ただいま。
○２番（加藤重夫君） 質問です。
    `;
    const statements = parsePdfText(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言がない場合は空配列を返す", () => {
    const text = `令和７年由仁町議会第１回定例会\n日程表\n出席議員名簿`;
    const statements = parsePdfText(text);
    expect(statements).toHaveLength(0);
  });

  it("複数行にまたがる発言を結合する", () => {
    const text = `
○町長（松村　論君） 今回の予算案について
説明いたします。詳細は
別添資料のとおりです。
○議長（後藤篤人君） ありがとうございました。
    `;
    const statements = parsePdfText(text);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.speakerRole).toBe("町長");
    expect(statements[0]!.content).toContain("今回の予算案について");
    expect(statements[0]!.content).toContain("別添資料のとおりです。");
  });
});

describe("extractHeldOnFromText", () => {
  it("令和年月日を YYYY-MM-DD に変換する", () => {
    const text = `
令和７年由仁町議会第１回定例会　第１号

令和７年３月４日（火）
    `;
    expect(extractHeldOnFromText(text)).toBe("2025-03-04");
  });

  it("全角数字の日付を変換する", () => {
    const text = `令和６年１２月１０日`;
    expect(extractHeldOnFromText(text)).toBe("2024-12-10");
  });

  it("日付がない場合は null を返す", () => {
    const text = `会議録の内容`;
    expect(extractHeldOnFromText(text)).toBeNull();
  });

  it("令和元年に対応する", () => {
    const text = `令和元年６月１０日`;
    expect(extractHeldOnFromText(text)).toBe("2019-06-10");
  });
});

describe("extractTitleFromText", () => {
  it("会議タイトルを抽出する", () => {
    const text = `令和7年由仁町議会第1回定例会　第1号\n令和7年3月4日（火）`;
    const title = extractTitleFromText(text);
    expect(title).not.toBeNull();
    expect(title).toContain("由仁町議会");
    expect(title).toContain("定例会");
  });

  it("全角数字の会議タイトルを抽出する", () => {
    const text = `令和７年由仁町議会第１回定例会　第１号`;
    const title = extractTitleFromText(text);
    expect(title).not.toBeNull();
    expect(title).toContain("定例会");
  });

  it("タイトルが見つからない場合は null を返す", () => {
    const text = `会議録の内容のみ`;
    expect(extractTitleFromText(text)).toBeNull();
  });
});
