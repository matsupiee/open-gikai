import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHtmlText,
  extractHtmUrl,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（佐藤長成君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("佐藤長成");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（村上英人君）　お答えいたします。");
    expect(result.speakerName).toBe("村上英人");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（平間喜久夫君）　説明いたします。");
    expect(result.speakerName).toBe("平間喜久夫");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（文谷政義君）　お答えします。");
    expect(result.speakerName).toBe("文谷政義");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("全角番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○１番（平間徹也君）　質問いたします。");
    expect(result.speakerName).toBe("平間徹也");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○3番（山田太郎君）　お聞きします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("お聞きします。");
  });

  it("総務課長を正しくパースする（複合役職名）", () => {
    const result = parseSpeaker("○総務課長（鈴木　賢君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木賢");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（田中一郎君）　暫時休憩します。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩します。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分　開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分　開議");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("総務課長（複合役職名）は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○マーカーで区切られた発言を抽出する", () => {
    const text = `
○議長（佐藤長成君）　ただいまから会議を開きます。
○１番（平間徹也君）　質問いたします。
○町長（村上英人君）　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("佐藤長成");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("平間徹也");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("村上英人");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("登壇ト書きをスキップする", () => {
    const text = `○町長（村上英人君）（登壇）
○議長（佐藤長成君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が SHA-256 ハッシュ形式で生成される", () => {
    const text = "○議長（佐藤長成君）　ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（佐藤長成君）　ただいま。
○１番（平間徹也君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言がない場合は空配列を返す", () => {
    const text = "会議録の内容はありません。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});

describe("extractHtmlText", () => {
  it("HTML タグを除去してプレーンテキストを返す", () => {
    const html = `
      <p>○議長（佐藤長成君）　<b>ただいまから</b>会議を開きます。</p>
      <p>○１番（平間徹也君）　質問いたします。</p>
    `;

    const text = extractHtmlText(html);
    expect(text).toContain("○議長（佐藤長成君）");
    expect(text).toContain("ただいまから");
    expect(text).not.toContain("<b>");
    expect(text).not.toContain("<p>");
  });

  it("<br> タグを改行に変換する", () => {
    const html = `<p>1行目<br/>2行目<br>3行目</p>`;
    const text = extractHtmlText(html);
    expect(text).toContain("1行目\n2行目\n3行目");
  });

  it("HTML エンティティをデコードする", () => {
    const html = `<p>A&amp;B &lt;C&gt; &quot;D&quot; &nbsp;E</p>`;
    const text = extractHtmlText(html);
    expect(text).toContain("A&B <C> \"D\"  E");
  });

  it("<script> <style> を除去する", () => {
    const html = `
      <script>var x = 1;</script>
      <style>.MsoNormal { color: red; }</style>
      <p>本文テキスト</p>
    `;
    const text = extractHtmlText(html);
    expect(text).not.toContain("var x");
    expect(text).not.toContain(".MsoNormal");
    expect(text).toContain("本文テキスト");
  });
});

describe("extractHtmUrl", () => {
  it("フレームセットから本体 HTM の URL を抽出する", () => {
    const mainHtml = `
      <html>
      <frameset cols="15%,85%">
        <frame src="R0606-2menu.html" name="menu">
        <frame src="R0606-2.htm" name="main">
      </frameset>
      </html>
    `;
    const mainUrl =
      "https://www.town.zao.miyagi.jp/gijiroku/gijiroku/R0606-2/R0606-2main.html";

    const htmUrl = extractHtmUrl(mainHtml, mainUrl);
    expect(htmUrl).toBe(
      "https://www.town.zao.miyagi.jp/gijiroku/gijiroku/R0606-2/R0606-2.htm",
    );
  });

  it(".htm フレームがない場合は null を返す", () => {
    const mainHtml = `<html><body><p>コンテンツなし</p></body></html>`;
    const mainUrl = "https://example.com/main.html";

    const htmUrl = extractHtmUrl(mainHtml, mainUrl);
    expect(htmUrl).toBeNull();
  });
});
