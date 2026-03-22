import { describe, expect, test } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatementsFromPlainText,
  extractSpeakerPageInfo,
} from "./detail";

describe("parseSpeaker", () => {
  test("○議長（氏名君） 形式", () => {
    const result = parseSpeaker("○議長（川越桂路君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("川越桂路");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  test("○名前+役職 形式 (田中市長)", () => {
    const result = parseSpeaker("○田中市長　答弁いたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("答弁いたします。");
  });

  test("番号議員 → speakerRole=議員", () => {
    const result = parseSpeaker("○１２番（宮﨑栄樹君）　質問があります。");
    expect(result.speakerName).toBe("宮﨑栄樹");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
  });

  test("括弧内補足を含む役職", () => {
    const result = parseSpeaker(
      "○青山支所長（兼地域振興総括監）（稲森真一君）　ご説明します。"
    );
    expect(result.speakerName).toBe("稲森真一");
    expect(result.speakerRole).toBe("青山支所長");
    expect(result.content).toBe("ご説明します。");
  });

  test("○マーカーなし（ヘッダーなし）", () => {
    const result = parseSpeaker("これは本文のみです。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("これは本文のみです。");
  });
});

describe("classifyKind", () => {
  test("市長 → answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  test("部長 → answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  test("課長 → answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  test("議長 → remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  test("委員長 → remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  test("議員 → question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  test("null → remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  test("部分一致: 環境センター長 → answer", () => {
    expect(classifyKind("環境センター長")).toBe("answer");
  });
});

describe("parseStatementsFromPlainText", () => {
  test("○マーカーで発言を分割", () => {
    const text = `○議長（田中太郎君）　開会します。
○議員（佐藤花子君）　質問があります。`;
    const stmts = parseStatementsFromPlainText(text);
    expect(stmts).toHaveLength(2);
    expect(stmts[0]!.speakerName).toBe("田中太郎");
    expect(stmts[0]!.kind).toBe("remark");
    expect(stmts[1]!.speakerName).toBe("佐藤花子");
    expect(stmts[1]!.kind).toBe("question");
  });

  test("複数行の発言をスペースで連結", () => {
    const text = `○田中市長　これは
    複数行の
    発言です。`;
    const stmts = parseStatementsFromPlainText(text);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]!.content).toBe("これは 複数行の 発言です。");
  });

  test("空テキストは空配列", () => {
    expect(parseStatementsFromPlainText("")).toEqual([]);
  });

  test("○マーカーなしのテキストは空配列", () => {
    expect(parseStatementsFromPlainText("普通のテキスト")).toEqual([]);
  });

  test("contentHash が生成される", () => {
    const text = "○田中市長　テスト";
    const stmts = parseStatementsFromPlainText(text);
    expect(stmts[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("offset が正しく計算される", () => {
    const text = `○田中市長　あいう
○佐藤部長　えお`;
    const stmts = parseStatementsFromPlainText(text);
    expect(stmts[0]!.startOffset).toBe(0);
    expect(stmts[0]!.endOffset).toBe(stmts[0]!.content.length);
    expect(stmts[1]!.startOffset).toBe(stmts[0]!.endOffset + 1);
  });
});

describe("extractSpeakerPageInfo", () => {
  test("パターンA: download フォームから抽出", () => {
    const html = `
      <FORM NAME="download" ACTION="/city/cgi-bin3/GetPerson.exe" METHOD="POST">
        <INPUT type="hidden" name="Code" value="abc123">
        <INPUT type="hidden" name="fileName" value="R050130A">
        <input type="checkbox" name="downloadPos" value="14">
        <input type="checkbox" name="downloadPos" value="2978">
      </FORM>
    `;
    const result = extractSpeakerPageInfo(html);
    expect(result.actionUrl).toBe("/city/cgi-bin3/GetPerson.exe");
    expect(result.code).toBe("abc123");
    expect(result.fileName).toBe("R050130A");
    expect(result.downloadPositions).toEqual(["14", "2978"]);
  });

  test("パターンB: download フォームなし — r_TextFrame.exe リンクから fallback", () => {
    const html = `
      <table>
        <tr><td>
          <A HREF="/city/cgi-bin3/r_TextFrame.exe?abc123/R030106A/0/0//10/1/3804//0/0/0" TARGET="TEXTW">議事日程</A>
        </td></tr>
        <tr><td>
          <A HREF="/city/cgi-bin3/r_TextFrame.exe?abc123/R030106A/3231/0//10/1/3804//0/0/0" TARGET="TEXTW">議長（斎藤武弘）</A>
        </td></tr>
        <tr><td>
          <A HREF="/city/cgi-bin3/r_TextFrame.exe?abc123/R030106A/5474/0//10/1/3804//0/0/0" TARGET="TEXTW">市長（佐藤孝弘）</A>
        </td></tr>
      </table>
    `;
    const speakersUrl = "http://www.kensakusystem.jp/city/cgi-bin3/r_Speakers.exe?abc123/R030106A/0/0//10/1/32767:0/3804/1//0/0/0";
    const result = extractSpeakerPageInfo(html, speakersUrl);
    expect(result.actionUrl).toBe("http://www.kensakusystem.jp/city/cgi-bin3/GetPerson.exe");
    expect(result.code).toBe("abc123");
    expect(result.fileName).toBe("R030106A");
    expect(result.downloadPositions).toEqual(["3231", "5474"]);
  });

  test("パターンB: position=0 の議事日程リンクはスキップ", () => {
    const html = `
      <A HREF="r_TextFrame.exe?abc/FILE/0/rest">議事日程</A>
      <A HREF="r_TextFrame.exe?abc/FILE/100/rest">議長</A>
    `;
    const result = extractSpeakerPageInfo(html, "http://example.com/cgi-bin3/r_Speakers.exe?test");
    expect(result.downloadPositions).toEqual(["100"]);
  });

  test("フォームもリンクもない場合は null を返す", () => {
    const result = extractSpeakerPageInfo("<html></html>", "http://example.com/r_Speakers.exe?test");
    expect(result.actionUrl).toBeNull();
    expect(result.downloadPositions).toEqual([]);
  });
});
