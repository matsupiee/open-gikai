import { describe, it, expect } from "vitest";
import {
  normalizeRole,
  classifyKind,
  parseStatements,
  findProceedingsStart,
} from "./detail";

describe("findProceedingsStart", () => {
  it("「議 事 の 経 過」マーカーの位置を返す", () => {
    const text = "提 出 議 案 目 録 ... 議 事 の 経 過 １．議長（大山二郎君）";
    const pos = findProceedingsStart(text);
    expect(pos).toBe(text.indexOf("議 事 の 経 過"));
  });

  it("「議事の経過」（スペースなし）の位置を返す", () => {
    const text = "名簿がここにある 議事の経過 １．議長（大山二郎君）";
    const pos = findProceedingsStart(text);
    expect(pos).toBe(text.indexOf("議事の経過"));
  });

  it("マーカーがない場合は 0 を返す", () => {
    expect(findProceedingsStart("テストテキスト")).toBe(0);
  });
});

describe("normalizeRole", () => {
  it("議長はそのまま返す", () => {
    expect(normalizeRole("議長")).toBe("議長");
  });

  it("副議長はそのまま返す", () => {
    expect(normalizeRole("副議長")).toBe("副議長");
  });

  it("町長はそのまま返す", () => {
    expect(normalizeRole("町長")).toBe("町長");
  });

  it("副町長はそのまま返す", () => {
    expect(normalizeRole("副町長")).toBe("副町長");
  });

  it("教育長はそのまま返す", () => {
    expect(normalizeRole("教育長")).toBe("教育長");
  });

  it("議会事務局長はそのまま返す", () => {
    expect(normalizeRole("議会事務局長")).toBe("議会事務局長");
  });

  it("番号議員を議員に変換する（全角）", () => {
    expect(normalizeRole("８番")).toBe("議員");
    expect(normalizeRole("１０番")).toBe("議員");
    expect(normalizeRole("１番")).toBe("議員");
  });

  it("番号議員を議員に変換する（半角）", () => {
    expect(normalizeRole("8番")).toBe("議員");
    expect(normalizeRole("10番")).toBe("議員");
  });

  it("課長サフィックスを課長に正規化する", () => {
    expect(normalizeRole("総務課長")).toBe("課長");
    expect(normalizeRole("保健福祉課長")).toBe("課長");
    expect(normalizeRole("まちづくり推進課長")).toBe("課長");
  });

  it("委員長サフィックスを委員長に正規化する", () => {
    expect(normalizeRole("議会運営委員会委員長")).toBe("委員長");
    expect(normalizeRole("予算特別委員会委員長")).toBe("委員長");
  });

  it("副委員長サフィックスを副委員長に正規化する", () => {
    expect(normalizeRole("議会運営委員会副委員長")).toBe("副委員長");
  });

  it("主幹サフィックスを主幹に正規化する", () => {
    expect(normalizeRole("総務課総務主幹")).toBe("主幹");
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

  it("主幹は answer", () => {
    expect(classifyKind("主幹")).toBe("answer");
  });

  it("議会事務局長は answer", () => {
    expect(classifyKind("議会事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言者パターンでテキストを分割する", () => {
    const text =
      "議 事 の 経 過 １．議長（大山二郎君） おはようございます。ただ今から会議を開きます。 １．８番（小玉勇君） 質問があります。 １．町長（庄司中君） お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("大山二郎");
    expect(statements[0]!.content).toBe(
      "おはようございます。ただ今から会議を開きます。"
    );

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.speakerName).toBe("小玉勇");
    expect(statements[1]!.content).toBe("質問があります。");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.speakerName).toBe("庄司中");
    expect(statements[2]!.content).toBe("お答えします。");
  });

  it("課長等のサフィックス付き役職を正しく処理する", () => {
    const text =
      "議 事 の 経 過 １．総務課長（土屋弘行君） ご説明いたします。 １．議長（大山二郎君） 次に進みます。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[0]!.speakerName).toBe("土屋弘行");
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.content).toBe("ご説明いたします。");

    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.kind).toBe("remark");
  });

  it("委員長を正しく処理する", () => {
    const text =
      "議 事 の 経 過 １．議会運営委員会委員長（今野雅信君） 委員会の結果を報告します。 １．議長（大山二郎君） ありがとうございます。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[0]!.speakerName).toBe("今野雅信");
    expect(statements[0]!.kind).toBe("remark");
  });

  it("各 statement に contentHash が付与される", () => {
    const text =
      "議 事 の 経 過 １．議長（大山二郎君） テスト発言です。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "議 事 の 経 過 １．議長（大山二郎君） ただいま。 １．８番（小玉勇君） 質問です。";
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("speakerName に名前を返す", () => {
    const text =
      "議 事 の 経 過 １．議長（大山二郎君） テスト発言です。";
    const statements = parseStatements(text);
    expect(statements[0]!.speakerName).toBe("大山二郎");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがない場合は空配列を返す", () => {
    expect(parseStatements("このテキストには発言者がいません")).toEqual([]);
  });

  it("ヘッダー部分の名簿をスキップして議事本体のみ処理する", () => {
    // ヘッダー部分には発言者パターンが含まれない想定
    const text =
      "提 出 議 案 目 録 報告第1号 なにかの報告 議 事 の 経 過 １．議長（大山二郎君） 開会します。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("開会します。");
  });
});
