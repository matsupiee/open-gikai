import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（小野辰夫）　これより本日の会議を開きます。");
    expect(result.speakerName).toBe("小野辰夫");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("これより本日の会議を開きます。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○２５番（仙波憲一）（登壇）　おはようございます。");
    expect(result.speakerName).toBe("仙波憲一");
    expect(result.speakerRole).toBe("２５番");
    expect(result.content).toBe("おはようございます。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○市長（古川拓哉）（登壇）　お答えします。");
    expect(result.speakerName).toBe("古川拓哉");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えします。");
  });

  it("複合役職を正しくパースする", () => {
    const result = parseSpeaker("○福祉部こども局長（沢田友子）（登壇）　お答えいたします。");
    expect(result.speakerName).toBe("沢田友子");
    expect(result.speakerRole).toBe("福祉部こども局長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育委員会事務局長をパースする", () => {
    const result = parseSpeaker("○教育委員会事務局長（竹林栄一）（登壇）　お答えいたします。");
    expect(result.speakerName).toBe("竹林栄一");
    expect(result.speakerRole).toBe("教育委員会事務局長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("市民環境部長をパースする", () => {
    const result = parseSpeaker("○市民環境部長（長井秀旗）（登壇）　お答えいたします。");
    expect(result.speakerName).toBe("長井秀旗");
    expect(result.speakerRole).toBe("市民環境部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副市長をパースする", () => {
    const result = parseSpeaker("○副市長（赤尾禎司）（登壇）　御挨拶を申し上げます。");
    expect(result.speakerName).toBe("赤尾禎司");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("御挨拶を申し上げます。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時００分開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時００分開議");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("番号付き議員は question", () => {
    expect(classifyKind("２５番")).toBe("question");
  });

  it("半角番号付き議員は question", () => {
    expect(classifyKind("25番")).toBe("question");
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

  it("局長は answer", () => {
    expect(classifyKind("福祉部こども局長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("教育委員会事務局長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言を正しく抽出する", () => {
    const html = `
      <div class="detail_free">
      　　午前１０時００分開議<br>
      ○議長（小野辰夫）　これより本日の会議を開きます。<br>
      　本日の議事日程につきましては、議事日程第２号のとおりであります。<br>
      ―――――――――― ◇ ――――――――――<br>
      ○議長（小野辰夫）　日程第１、会議録署名議員の指名を行います。<br>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("小野辰夫");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "これより本日の会議を開きます。\n本日の議事日程につきましては、議事日程第２号のとおりであります。",
    );

    expect(statements[1]!.speakerName).toBe("小野辰夫");
    expect(statements[1]!.kind).toBe("remark");
  });

  it("議員と答弁者の発言を正しく分類する", () => {
    const html = `
      <div>
      　　午前１０時００分開議<br>
      ○議長（小野辰夫）　まず、仙波憲一議員。<br>
      <a id="9">○２５番（仙波憲一）</a>（登壇）　質問いたします。<br>
      ○議長（小野辰夫）　答弁を求めます。古川市長。<br>
      <a id="10">○市長（古川拓哉）</a>（登壇）　お答えします。<br>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(4);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("仙波憲一");
    expect(statements[1]!.speakerRole).toBe("２５番");
    expect(statements[2]!.kind).toBe("remark");
    expect(statements[3]!.kind).toBe("answer");
    expect(statements[3]!.speakerName).toBe("古川拓哉");
    expect(statements[3]!.speakerRole).toBe("市長");
  });

  it("継続行を同じ発言にまとめる", () => {
    const html = `
      <div>
      　　午前１０時００分開議<br>
      ○２５番（仙波憲一）（登壇）　おはようございます。<br>
      　自民クラブの仙波憲一です。<br>
      　それでは質問を行います。<br>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe(
      "おはようございます。\n自民クラブの仙波憲一です。\nそれでは質問を行います。",
    );
  });

  it("セクション区切りと日程行をスキップする", () => {
    const html = `
      <div>
      　　午前１０時００分開議<br>
      ―――――――――― ◇ ――――――――――<br>
      　　日程第１　会議録署名議員の指名<br>
      ○議長（小野辰夫）　指名を行います。<br>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("小野辰夫");
  });

  it("開議マーカーがない場合は空配列を返す", () => {
    const html = `<div>○議長（小野辰夫）　テスト<br></div>`;
    const statements = parseStatements(html);
    expect(statements).toHaveLength(0);
  });

  it("contentHash が生成される", () => {
    const html = `
      <div>
      　　午前１０時００分開議<br>
      ○議長（小野辰夫）　テスト。<br>
      </div>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <div>
      　　午前１０時００分開議<br>
      ○議長（小野辰夫）　一つ目。<br>
      ○議長（小野辰夫）　二つ目。<br>
      </div>
    `;

    const statements = parseStatements(html);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("一つ目。".length);
    expect(statements[1]!.startOffset).toBe("一つ目。".length + 1);
  });
});
