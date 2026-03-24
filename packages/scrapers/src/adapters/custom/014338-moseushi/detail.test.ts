import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseSpeakerLabel,
  parsePdfStatements,
  parsePdfLinksFromDetail,
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
    const result = parseSpeakerLabel("議長（山田太郎君）");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("山田太郎");
  });

  it("町長（氏名君）形式をパースする", () => {
    const result = parseSpeakerLabel("町長（鈴木一郎君）");
    expect(result.speakerRole).toBe("町長");
    expect(result.speakerName).toBe("鈴木一郎");
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

  it("「氏」サフィックスを除去する", () => {
    const result = parseSpeakerLabel("議員（佐藤花子氏）");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("佐藤花子");
  });
});

describe("parsePdfStatements", () => {
  it("PDF テキストから発言を抽出する", () => {
    const text = `
妹背牛町議会定例会会議録
令和7年9月15日

〇議長（山田太郎君） ただいまから開議します。
〇町長（鈴木一郎君） 提案理由を説明します。
〇議員（佐藤次郎君） 質問いたします。
    `;

    const statements = parsePdfStatements(text);
    expect(statements.length).toBeGreaterThanOrEqual(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.kind).toBe("question");
  });

  it("発言がない場合は空配列を返す", () => {
    const text = `妹背牛町議会 会議録\n日程表\n出席議員名簿`;
    const statements = parsePdfStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("contentHash が生成される", () => {
    const text = `〇議長（山田太郎君） ただいまから会議を開きます。`;
    const statements = parsePdfStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `
〇議長（山田太郎君） ただいま。
〇議員（佐藤次郎君） 質問です。
    `;
    const statements = parsePdfStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});

describe("parsePdfLinksFromDetail", () => {
  it("詳細ページ HTML から PDF リンクを抽出する", () => {
    const html = `
      <div>
        <p>令和7年第3回定例会</p>
        <a href="files/7.9.pdf">会議録ダウンロード</a>
        <a href="files/7.9.1.pdf">第2日目</a>
      </div>
    `;
    const baseUrl =
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/2025-1119-1419-34.html";

    const urls = parsePdfLinksFromDetail(html, baseUrl);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/files/7.9.pdf",
    );
    expect(urls[1]).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/files/7.9.1.pdf",
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録なし</p></div>`;
    const urls = parsePdfLinksFromDetail(
      html,
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/test.html",
    );
    expect(urls).toHaveLength(0);
  });

  it("重複 URL を除外する", () => {
    const html = `
      <a href="files/7.9.pdf">1回目</a>
      <a href="files/7.9.pdf">2回目（同じファイル）</a>
    `;
    const urls = parsePdfLinksFromDetail(
      html,
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/test.html",
    );
    expect(urls).toHaveLength(1);
  });

  it("絶対 URL の PDF も抽出できる", () => {
    const html = `
      <a href="https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/files/31.3.19.pdf">平成31年3月</a>
    `;
    const urls = parsePdfLinksFromDetail(
      html,
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/h31-1_1.html",
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/files/31.3.19.pdf",
    );
  });
});
