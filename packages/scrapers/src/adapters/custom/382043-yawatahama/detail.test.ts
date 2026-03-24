import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（菊池　彰君）　これより本日の会議を開きます。");
    expect(result.speakerName).toBe("菊池　彰");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("これより本日の会議を開きます。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○市長（大城一郎君）　ご質問にお答えします。");
    expect(result.speakerName).toBe("大城一郎");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("ご質問にお答えします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（河野光徳君）　お答えいたします。");
    expect(result.speakerName).toBe("河野光徳");
    expect(result.speakerRole).toBe("総務課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("○副市長（山本明君）　御挨拶申し上げます。");
    expect(result.speakerName).toBe("山本明");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("御挨拶申し上げます。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分開議");
  });

  it("内容が空の場合は空文字を返す", () => {
    const result = parseSpeaker("○議長（菊池　彰君）");
    expect(result.speakerName).toBe("菊池　彰");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("建設部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("議員名（役職なし）は question", () => {
    expect(classifyKind("山田一郎")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseHeldOn", () => {
  it("令和の日付を正しくパースする", () => {
    const html = `<p>令和7年12月10日（水曜日）　午前10時開議</p>`;
    expect(parseHeldOn(html)).toBe("2025-12-10");
  });

  it("平成の日付を正しくパースする", () => {
    const html = `<p>平成30年3月1日（木曜日）　午前10時開議</p>`;
    expect(parseHeldOn(html)).toBe("2018-03-01");
  });

  it("令和元年を正しく変換する", () => {
    const html = `<p>令和元年6月10日（月曜日）</p>`;
    expect(parseHeldOn(html)).toBe("2019-06-10");
  });

  it("全角数字の日付を正しくパースする", () => {
    const html = `<p>令和７年３月１０日（火曜日）</p>`;
    expect(parseHeldOn(html)).toBe("2025-03-10");
  });

  it("日付がない場合は null を返す", () => {
    const html = `<p>八幡浜市議会定例会</p>`;
    expect(parseHeldOn(html)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("基本的な発言を正しく抽出する", () => {
    const html = `
      <div>
      <p>令和7年12月10日（水曜日）　午前10時開議</p>
      <p>○議長（菊池　彰君）　これより本日の会議を開きます。</p>
      <p>　本日の議事日程につきましては、配付のとおりであります。</p>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("菊池　彰");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "これより本日の会議を開きます。\n本日の議事日程につきましては、配付のとおりであります。",
    );
  });

  it("議員と答弁者の発言を正しく分類する", () => {
    const html = `
      <div>
      <p>令和7年12月10日（水曜日）　午前10時開議</p>
      <p>○議長（菊池　彰君）　山田議員。</p>
      <p>○山田太郎（山田太郎君）　質問します。</p>
      <p>○市長（大城一郎君）　お答えします。</p>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("大城一郎");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("登壇表記はスキップする", () => {
    const html = `
      <div>
      <p>令和7年12月10日（水曜日）　午前10時開議</p>
      <p>〔市長　大城一郎君登壇〕</p>
      <p>○市長（大城一郎君）　お答えします。</p>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("市長");
  });

  it("contentHash が生成される", () => {
    const html = `
      <div>
      <p>令和7年12月10日（水曜日）　午前10時開議</p>
      <p>○議長（菊池　彰君）　テスト発言。</p>
      </div>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <div>
      <p>令和7年12月10日（水曜日）　午前10時開議</p>
      <p>○議長（菊池　彰君）　一つ目。</p>
      <p>○市長（大城一郎君）　二つ目。</p>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("一つ目。".length);
    expect(statements[1]!.startOffset).toBe("一つ目。".length + 1);
  });

  it("statementsが空の場合は空配列を返す", () => {
    const html = `<div><p>八幡浜市議会</p></div>`;
    const statements = parseStatements(html);
    expect(statements).toHaveLength(0);
  });

  it("複数行の発言をまとめる", () => {
    const html = `
      <div>
      <p>令和7年12月10日（水曜日）　午前10時開議</p>
      <p>○山田太郎（山田太郎君）　おはようございます。</p>
      <p>　続きまして、質問いたします。</p>
      <p>　以上です。</p>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe(
      "おはようございます。\n続きまして、質問いたします。\n以上です。",
    );
  });
});
