import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("括弧付き役職形式をパースする（議長）", () => {
    const result = parseSpeaker("○議長（杉本尚喜議員）　ただいまの出席議員は18名であります。");
    expect(result.speakerName).toBe("杉本尚喜");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまの出席議員は18名であります。");
  });

  it("括弧付き役職形式をパースする（委員長）", () => {
    const result = parseSpeaker("○議会運営委員長（髙崎正風議員）　本定例会の会期及び日程について報告します。");
    expect(result.speakerName).toBe("髙崎正風");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("本定例会の会期及び日程について報告します。");
  });

  it("括弧なし役職形式をパースする（市長）", () => {
    const result = parseSpeaker("○椎木伸一市長　提案理由を申し上げます。");
    expect(result.speakerName).toBe("椎木伸一");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("提案理由を申し上げます。");
  });

  it("括弧なし役職形式をパースする（部長）", () => {
    const result = parseSpeaker("○山田政策経営部長　ご説明申し上げます。");
    expect(result.speakerName).toBe("山田政策経営");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("発言番号付き形式をパースする", () => {
    const result = parseSpeaker("○１２番（吉元勇議員）　質問いたします。");
    expect(result.speakerName).toBe("吉元勇");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("発言番号付き形式をパースする（半角数字）", () => {
    const result = parseSpeaker("○6番（田中秀一議員）　お伺いします。");
    expect(result.speakerName).toBe("田中秀一");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("お伺いします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時　開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時　開議");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（鶴田均議員）　暫時休憩いたします。");
    expect(result.speakerName).toBe("鶴田均");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩いたします。");
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
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

  it("末尾が answer role にマッチする場合 answer", () => {
    expect(classifyKind("政策経営部長")).toBe("answer");
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("p[id=text_N] 要素から発言を抽出する（最初の要素はスキップ）", () => {
    const html = `
      <p id="text_1">
        令和７年出水市議会第４回定例会会議録第１号
        令和７年11月21日
        出席議員　１８名
      </p>
      <p id="text_2">
        ○議長（杉本尚喜議員）　おはようございます。
      </p>
      <p id="text_3">
        ○椎木伸一市長　提案理由を申し上げます。
      </p>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("杉本尚喜");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("おはようございます。");
    expect(statements[1]!.speakerName).toBe("椎木伸一");
    expect(statements[1]!.speakerRole).toBe("市長");
    expect(statements[1]!.kind).toBe("answer");
  });

  it("1つのp要素に複数の発言が混在する場合を処理する", () => {
    const html = `
      <p id="text_1">ヘッダー</p>
      <p id="text_2">
        △　日程第２会期及び会期日程の決定
        ○議長（杉本尚喜議員）　日程第２を議題といたします。
        ○議長（杉本尚喜議員）　御異議なしと認めます。
      </p>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toContain("日程第２");
    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[2]!.speakerRole).toBe("議長");
  });

  it("空のp要素はスキップする", () => {
    const html = `
      <p id="text_1">ヘッダー</p>
      <p id="text_2"></p>
      <p id="text_3">○議長（杉本尚喜議員）　会議を開きます。</p>
      <p id="text_4">   </p>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
  });

  it("contentHash が SHA-256 の 64 文字 hex 文字列になる", () => {
    const html = `
      <p id="text_1">ヘッダー</p>
      <p id="text_2">○議長（杉本尚喜議員）　会議を開きます。</p>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <p id="text_1">ヘッダー</p>
      <p id="text_2">○議長（杉本尚喜議員）　会議を開きます。</p>
      <p id="text_3">○椎木伸一市長　承りました。</p>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("会議を開きます。".length);
    expect(statements[1]!.startOffset).toBe("会議を開きます。".length + 1);
  });

  it("HTML タグを除去する", () => {
    const html = `
      <p id="text_1">ヘッダー</p>
      <p id="text_2">○議長（杉本尚喜議員）　<b>ただいま</b>から<br/>会議を開きます。</p>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toContain("ただいまから");
  });

  it("text_ の id を持たない p 要素は無視する", () => {
    const html = `
      <p id="text_1">ヘッダー</p>
      <p class="other">○議長（杉本尚喜議員）　無視されるべき</p>
      <p id="text_2">○椎木伸一市長　承りました。</p>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("椎木伸一");
  });
});
