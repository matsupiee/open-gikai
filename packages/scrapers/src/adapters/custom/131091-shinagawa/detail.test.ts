import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("◯渡辺議長 ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("渡辺");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("◯こしば総務委員長 ただいま議題に供されました。");
    expect(result.speakerName).toBe("こしば総務");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいま議題に供されました。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("◯安藤たい作議員 質問いたします。");
    expect(result.speakerName).toBe("安藤たい作");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("区長を正しくパースする", () => {
    const result = parseSpeaker("◯森澤区長 お答えいたします。");
    expect(result.speakerName).toBe("森澤");
    expect(result.speakerRole).toBe("区長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副区長を正しくパースする", () => {
    const result = parseSpeaker("◯田中副区長 ご説明いたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副区長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("部長を正しくパースする", () => {
    const result = parseSpeaker("◯山田総務部長 ご報告いたします。");
    expect(result.speakerName).toBe("山田総務");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("◯マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("◯マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("◯田中太郎 発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("発言します。");
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

  it("区長は answer", () => {
    expect(classifyKind("区長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("li 要素から発言を抽出する", () => {
    const html = `
      <ol>
        <li>◯渡辺議長　ただいまから本日の会議を開きます。</li>
        <li>◯渡辺議長　会議録署名議員をご指名申し上げます。</li>
        <li>◯安藤たい作議員　質問いたします。</li>
      </ol>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("渡辺");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[2]!.speakerName).toBe("安藤たい作");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("HTML タグを除去してプレーンテキストにする", () => {
    const html = `
      <ol>
        <li>◯渡辺議長　<b>ただいま</b>から本日の<br/>会議を開きます。</li>
      </ol>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("ただいまから本日の 会議を開きます。");
  });

  it("空の li はスキップする", () => {
    const html = `
      <ol>
        <li></li>
        <li>◯渡辺議長　ただいまから会議を開きます。</li>
        <li>   </li>
      </ol>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
  });

  it("contentHash が生成される", () => {
    const html = `
      <ol>
        <li>◯渡辺議長　ただいまから会議を開きます。</li>
      </ol>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <ol>
        <li>◯渡辺議長　ただいま。</li>
        <li>◯田中議員　質問です。</li>
      </ol>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});
