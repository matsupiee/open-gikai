import { describe, it, expect } from "vitest";
import {
  normalizeRole,
  classifyKind,
  parseStatements,
  findProceedingsStart,
} from "./detail";

describe("findProceedingsStart", () => {
  it("開会マーカーの位置を返す", () => {
    const text = "名簿がここにある 午前１０時０２分 開会 議長 ただいまから";
    const pos = findProceedingsStart(text);
    expect(pos).toBe(text.indexOf("午前"));
  });

  it("開議マーカーの位置を返す", () => {
    const text = "名簿がここにある 午前10時00分 開議 議長 再開します";
    const pos = findProceedingsStart(text);
    expect(pos).toBe(text.indexOf("午前"));
  });

  it("マーカーがない場合は 0 を返す", () => {
    expect(findProceedingsStart("テストテキスト")).toBe(0);
  });
});

describe("normalizeRole", () => {
  it("議長はそのまま返す", () => {
    expect(normalizeRole("議長")).toBe("議長");
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

  it("番号議員を議員に変換する", () => {
    expect(normalizeRole("３番")).toBe("議員");
    expect(normalizeRole("10番")).toBe("議員");
    expect(normalizeRole("１番")).toBe("議員");
  });

  it("課長サフィックスを課長に正規化する", () => {
    expect(normalizeRole("健康福祉課長")).toBe("課長");
    expect(normalizeRole("総務課長")).toBe("課長");
  });

  it("室長サフィックスを室長に正規化する", () => {
    expect(normalizeRole("地域強靱化対策室長")).toBe("室長");
  });

  it("委員長サフィックスを委員長に正規化する", () => {
    expect(normalizeRole("議会運営委員長")).toBe("委員長");
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
  it("役職名でテキストを分割する", () => {
    const text =
      "午前１０時開会。 議長 ただいまから本日の会議を開きます。 ３番 質問があります。 町長 お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe(
      "ただいまから本日の会議を開きます。"
    );

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.content).toBe("質問があります。");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.content).toBe("お答えします。");
  });

  it("課長等のサフィックス付き役職を正しく処理する", () => {
    const text =
      "お願いします。 健康福祉課長 ご説明いたします。 議長 次に進みます。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.content).toBe("ご説明いたします。");

    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.kind).toBe("remark");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "します。 議長 テスト発言です。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "開会。 議長 ただいま。 ３番 質問です。";
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("speakerName は null を返す（舟形町PDFには個人名なし）", () => {
    const text = "します。 議長 テスト発言です。";
    const statements = parseStatements(text);
    expect(statements[0]!.speakerName).toBeNull();
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがない場合は空配列を返す", () => {
    expect(parseStatements("このテキストには発言者がいません")).toEqual([]);
  });

  it("閉じ括弧の後にも発言者を検出する", () => {
    const text =
      "（「異議なし」の声あり） 議長 異議なしと認めます。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("異議なしと認めます。");
  });
});
