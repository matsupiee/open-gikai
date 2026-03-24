import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseSpeakerLabel,
  parseStatementsNew,
  parseStatementsOld,
  parseStatements,
  extractHeldOnFromContent,
  parseFrameUrls,
  parseIndexFrameUrls,
  parsePdfText,
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
});

describe("parseSpeakerLabel", () => {
  it("議長（氏名君）形式をパースする", () => {
    const result = parseSpeakerLabel("議長（鵜川和彦君）");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("鵜川和彦");
  });

  it("町長（氏名君）形式をパースする", () => {
    const result = parseSpeakerLabel("町長（椿原紀昭君）");
    expect(result.speakerRole).toBe("町長");
    expect(result.speakerName).toBe("椿原紀昭");
  });

  it("役職のみの場合（氏名なし）", () => {
    const result = parseSpeakerLabel("議長");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBeNull();
  });

  it("副委員長は副委員長として認識する（委員長より先にマッチ）", () => {
    const result = parseSpeakerLabel("副委員長（田中一郎君）");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.speakerName).toBe("田中一郎");
  });

  it("全角スペースを含む氏名を正規化する", () => {
    const result = parseSpeakerLabel("議員（齊　藤　義　崇君）");
    // parseSpeakerLabel 内では全角スペース正規化はしない（normalizeSpacedName が担当）
    expect(result.speakerRole).toBe("議員");
  });
});

describe("parseStatementsNew", () => {
  it("近年形式の発言を抽出する", () => {
    const html = `
      <pre>令和７年栗山町議会定例会１２月定例会議会議録（第１日目）</pre>
      〇<b>議長（鵜川和彦君）</b>　ただいまから開議します。<br>
      〇<b>町長（椿原紀昭君）</b>　ご説明いたします。<br>
      〇<b>議員（齊藤義崇君）</b>　質問いたします。<br>
    `;

    const statements = parseStatementsNew(html);

    expect(statements.length).toBeGreaterThanOrEqual(3);

    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("鵜川和彦");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから開議します。");

    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("◎ 議事進行行はスキップする", () => {
    const html = `
      ◎<b>開議の宣告</b><br>
      〇<b>議長（鵜川和彦君）</b>　開議します。<br>
    `;

    const statements = parseStatementsNew(html);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が生成される", () => {
    const html = `〇<b>議長（鵜川和彦君）</b>　ただいまから会議を開きます。<br>`;
    const statements = parseStatementsNew(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      〇<b>議長（鵜川和彦君）</b>　ただいま。<br>
      〇<b>議員（田中一郎君）</b>　質問です。<br>
    `;

    const statements = parseStatementsNew(html);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});

describe("parseStatementsOld", () => {
  it("旧形式の table 構造から発言を抽出する", () => {
    const html = `
      <table class="type0">
        <tr>
          <td class="speakerchairperson">○<span class="chairperson">議長（鵜川和彦君）</span></td>
          <td class="speechchairperson">ただいまから開議します。</td>
        </tr>
        <tr>
          <td class="speakermayor">◎<span class="mayor">町長（椿原紀昭君）</span></td>
          <td class="speechmayor">ご説明いたします。</td>
        </tr>
      </table>
    `;

    const statements = parseStatementsOld(html);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから開議します。");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("type0 テーブルがあれば旧形式パーサーを使用する", () => {
    const html = `
      <table class="type0">
        <tr>
          <td class="speakermember">○<span class="member">議員（田中一郎君）</span></td>
          <td class="speechmember">質問です。</td>
        </tr>
      </table>
    `;
    const statements = parseStatements(html);
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.kind).toBe("question");
  });

  it("type0 テーブルがなければ近年形式パーサーを使用する", () => {
    const html = `〇<b>議長（鵜川和彦君）</b>　開議します。<br>`;
    const statements = parseStatements(html);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});

describe("extractHeldOnFromContent", () => {
  it("<pre> タグ内の日付を抽出する", () => {
    const html = `
      <pre>
令和７年栗山町議会定例会１２月定例会議会議録（第１日目）
令和７年１２月９日　午前　９時３０分開議
      </pre>
    `;
    expect(extractHeldOnFromContent(html)).toBe("2025-12-09");
  });

  it("<pre> タグがない場合は HTML 全体から日付を抽出する", () => {
    const html = `<p>令和7年6月15日開催の会議録</p>`;
    expect(extractHeldOnFromContent(html)).toBe("2025-06-15");
  });

  it("日付がない場合は null を返す", () => {
    const html = `<p>会議録の内容</p>`;
    expect(extractHeldOnFromContent(html)).toBeNull();
  });

  it("平成年号にも対応する", () => {
    const html = `<pre>平成30年12月10日</pre>`;
    expect(extractHeldOnFromContent(html)).toBe("2018-12-10");
  });
});

describe("parseFrameUrls", () => {
  it("近年形式のフレームセットから URL を抽出する", () => {
    const html = `
      <frameset rows="130,*">
        <frame src="r0712t-title.html" name="title">
        <frameset cols="300,*">
          <frame src="r0712t-index.html" name="index">
          <frame src="r0712t01.html" name="main">
        </frameset>
      </frameset>
    `;
    const baseUrl =
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t.html";

    const { indexUrl, contentUrls } = parseFrameUrls(html, baseUrl);

    expect(indexUrl).toBe(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t-index.html",
    );
    expect(contentUrls).toContain(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t01.html",
    );
  });

  it("旧形式のフレームセットから URL を抽出する", () => {
    const html = `
      <frameset cols="200,*">
        <frame src="h30-t.html">
        <frame src="h30-l.html">
        <frame src="h30.html">
      </frameset>
    `;
    const baseUrl =
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/h30/h30-n.html";

    const { indexUrl, contentUrls } = parseFrameUrls(html, baseUrl);

    expect(indexUrl).toBe(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/h30/h30-l.html",
    );
    expect(contentUrls).toContain(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/h30/h30.html",
    );
  });
});

describe("parseIndexFrameUrls", () => {
  it("インデックスフレームから本文 URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="r0712t01.html">第1日目</a></li>
        <li><a href="r0712t02.html">第2日目</a></li>
        <li><a href="r0712t03.html">第3日目</a></li>
      </ul>
    `;
    const indexUrl =
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t-index.html";

    const urls = parseIndexFrameUrls(html, indexUrl);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t01.html",
    );
    expect(urls[2]).toBe(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t03.html",
    );
  });

  it("重複 URL を除外する", () => {
    const html = `
      <a href="r0712t01.html">第1日目</a>
      <a href="r0712t01.html">再掲</a>
    `;
    const indexUrl =
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t-index.html";

    const urls = parseIndexFrameUrls(html, indexUrl);
    expect(urls).toHaveLength(1);
  });
});

describe("parsePdfText", () => {
  it("PDF テキストから発言を抽出する", () => {
    const text = `
令和７年栗山町議会臨時会議会議録
令和７年５月１５日

〇議長（鵜川和彦君） ただいまから開議します。
〇町長（椿原紀昭君） 提案理由を説明します。
〇議員（田中一郎君） 質問いたします。
    `;

    const statements = parsePdfText(text);
    expect(statements.length).toBeGreaterThanOrEqual(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.kind).toBe("question");
  });

  it("発言がない場合は空配列を返す", () => {
    const text = `令和７年栗山町議会 会議録\n日程表\n出席議員名簿`;
    const statements = parsePdfText(text);
    expect(statements).toHaveLength(0);
  });
});
