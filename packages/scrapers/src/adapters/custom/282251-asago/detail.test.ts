import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker(
      "○議長（森田　龍司君）　ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("森田龍司");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("議員（議席番号付き）を正しくパースする", () => {
    const result = parseSpeaker(
      "○議員（17番　渕本　　稔君）　質問いたします。",
    );
    expect(result.speakerName).toBe("渕本稔");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker(
      "○市長（藤岡　　勇君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("藤岡勇");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("複合役職（政策担当部長）を正しくパースする", () => {
    const result = parseSpeaker(
      "○政策担当部長（掃部　直樹君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("掃部直樹");
    expect(result.speakerRole).toBe("政策担当部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker(
      "○教育長（田中太郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("理事兼企画総務部長を正しくパースする", () => {
    const result = parseSpeaker(
      "○理事兼企画総務部長（山田花子君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("理事兼企画総務部長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("支所長を正しくパースする", () => {
    const result = parseSpeaker(
      "○生野支所長（佐藤一郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("生野支所長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時開議");
  });

  it("応招しなかった議員パターン", () => {
    const result = parseSpeaker("○応招しなかった議員（なし）");
    expect(result.speakerName).toBe("なし");
    expect(result.speakerRole).toBe("応招しなかった議員");
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

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("政策担当部長は answer", () => {
    expect(classifyKind("政策担当部長")).toBe("answer");
  });

  it("理事兼企画総務部長は answer", () => {
    expect(classifyKind("理事兼企画総務部長")).toBe("answer");
  });

  it("生野支所長は answer", () => {
    expect(classifyKind("生野支所長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("div 要素から発言を抽出する", () => {
    const html = `
      <div id='001'<b><font face='ＭＳ ゴシック' color='#800000'>001 ○議長（森田　龍司君）</font></b>　ただいまから本日の会議を開きます。</br></div>
      <div id='002'<b><font face='ＭＳ ゴシック' color='#800000'>002 ○議員（17番　渕本　　稔君）</font></b>　質問いたします。</br></div>
      <div id='003'<b><font face='ＭＳ ゴシック' color='#800000'>003 ○市長（藤岡　　勇君）</font></b>　お答えいたします。</br></div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("森田龍司");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "ただいまから本日の会議を開きます。",
    );

    expect(statements[1]!.speakerName).toBe("渕本稔");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("藤岡勇");
    expect(statements[2]!.speakerRole).toBe("市長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("HTML タグを除去してプレーンテキストにする", () => {
    const html = `
      <div id='001'<b><font face='ＭＳ ゴシック' color='#800000'>001 ○議長（森田　龍司君）</font></b>　<b>ただいま</b>から本日の</br>会議を開きます。</br></div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe(
      "ただいまから本日の\n会議を開きます。",
    );
  });

  it("空の div はスキップする", () => {
    const html = `
      <div id='001'<b><font face='ＭＳ ゴシック' color='#800000'>001 ○議長（森田　龍司君）</font></b>　ただいまから会議を開きます。</br></div>
      <div id='002'></div>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
  });

  it("contentHash が生成される", () => {
    const html = `
      <div id='001'<b><font face='ＭＳ ゴシック' color='#800000'>001 ○議長（森田　龍司君）</font></b>　ただいまから会議を開きます。</br></div>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <div id='001'<b><font face='ＭＳ ゴシック' color='#800000'>001 ○議長（森田　龍司君）</font></b>　ただいま。</br></div>
      <div id='002'<b><font face='ＭＳ ゴシック' color='#800000'>002 ○議員（１番　田中太郎君）</font></b>　質問です。</br></div>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("○マーカーなしの div はスキップする", () => {
    const html = `
      <div id='001'<b><font face='ＭＳ ゴシック' color='#800000'>001 ○議長（森田　龍司君）</font></b>　ただいまから会議を開きます。</br></div>
      <div id='002'>議事日程の配付について</div>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
  });
});
