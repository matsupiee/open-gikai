import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseSpeakerFromTsuukou,
} from "./detail";

describe("parseSpeakerFromTsuukou", () => {
  it("通告1　阿部隆弘議員 から名前を抽出する", () => {
    expect(parseSpeakerFromTsuukou("通告1　阿部隆弘議員")).toBe("阿部隆弘");
  });

  it("通告2 山田花子議員（半角スペース）から名前を抽出する", () => {
    expect(parseSpeakerFromTsuukou("通告2 山田花子議員")).toBe("山田花子");
  });

  it("通告10　鈴木一郎議員 から名前を抽出する", () => {
    expect(parseSpeakerFromTsuukou("通告10　鈴木一郎議員")).toBe("鈴木一郎");
  });

  it("通告形式でない文字列は null を返す", () => {
    expect(parseSpeakerFromTsuukou("議長　田中太郎")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長（括弧付き）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田中太郎君）　ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（括弧付き）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（山田次郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("山田次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号＋括弧付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○3番（佐藤花子君）　質問します。",
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("名前＋役職パターン（括弧なし）を解析する", () => {
    const result = parseSpeaker(
      "○田中太郎議長　ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副委員長パターンを解析する（長い役職が先）", () => {
    const result = parseSpeaker(
      "○副委員長（高橋三郎君）　委員会を開会します。",
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("委員会を開会します。");
  });

  it("課長（括弧付き）パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（伊藤四郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("マーカーなしの場合は content のみ", () => {
    const result = parseSpeaker("議事日程第１号が配布されております。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("議事日程第１号が配布されております。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
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

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements（通告形式）", () => {
  it("通告番号でテキストを分割して ParsedStatement を生成する", () => {
    const text = `通告1　阿部隆弘議員
1．農業振興について
中標津町における農業の現状と課題について質問します。

通告2　山田花子議員
1．福祉行政について
高齢者福祉の充実を求めます。`;

    const statements = parseStatements(text);

    expect(statements.length).toBe(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("阿部隆弘");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.content).toContain("農業振興について");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("山田花子");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.content).toContain("福祉行政について");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = `通告1　阿部隆弘議員
農業振興について質問します。`;

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("本文が空のブロックはスキップする", () => {
    const text = `通告1　阿部隆弘議員

通告2　山田花子議員
質問内容があります。`;

    const statements = parseStatements(text);
    expect(statements.length).toBe(1);
    expect(statements[0]!.speakerName).toBe("山田花子");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("parseStatements（○マーカー形式）", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（田中太郎君）　ただいまから本日の会議を開きます。
○3番（佐藤花子君）　質問があります。
○町長（山田次郎君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山田次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });
});
