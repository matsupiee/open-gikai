import { describe, expect, it } from "vitest";
import {
  classifyKind,
  findMatchingNewsletterIssue,
  parseNewsletterListPage,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議員ラベルから氏名と役職を抽出する", () => {
    expect(parseSpeaker("田村議員の質問")).toEqual({
      speakerName: "田村",
      speakerRole: "議員",
    });
  });

  it("村長ラベルから氏名と役職を抽出する", () => {
    expect(parseSpeaker("畑中村長の答弁")).toEqual({
      speakerName: "畑中",
      speakerRole: "村長",
    });
  });
});

describe("classifyKind", () => {
  it("議員を質問として分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("村長を答弁として分類する", () => {
    expect(classifyKind("村長")).toBe("answer");
  });
});

describe("parseNewsletterListPage", () => {
  it("議会だより PDF 一覧を抽出する", () => {
    const html = `
      <ul class="linkList">
        <li class="list_icon_pdf">
          <a href="/files/100869205.pdf" target="_blank">
            2026（令和8）年1月31日号（No.94）
          </a>
        </li>
        <li class="list_icon_pdf">
          <a href="/files/100868724.pdf" target="_blank">
            2025（令和7）年10月31日号（No.93）
          </a>
        </li>
      </ul>
    `;

    expect(parseNewsletterListPage(html)).toEqual([
      {
        pdfUrl: "http://www.vill.higashidoori.lg.jp/files/100869205.pdf",
        publishedOn: "2026-01-31",
        issueNumber: 94,
      },
      {
        pdfUrl: "http://www.vill.higashidoori.lg.jp/files/100868724.pdf",
        publishedOn: "2025-10-31",
        issueNumber: 93,
      },
    ]);
  });
});

describe("findMatchingNewsletterIssue", () => {
  it("12月定例会に翌年1月号を対応付ける", () => {
    expect(
      findMatchingNewsletterIssue(
        [
          {
            pdfUrl: "http://www.vill.higashidoori.lg.jp/files/100869205.pdf",
            publishedOn: "2026-01-31",
            issueNumber: 94,
          },
        ],
        "2025-12-05",
      ),
    ).toEqual({
      pdfUrl: "http://www.vill.higashidoori.lg.jp/files/100869205.pdf",
      publishedOn: "2026-01-31",
      issueNumber: 94,
    });
  });
});

describe("parseStatements", () => {
  it("一般質問の質問・答弁ブロックを抽出する", () => {
    const text = `
      第4回定例会（一般質問）
      【田村議員の質問】
      現在、東通村におけるクマの出没状況と今後の被害対策についてお伺いする。
      【畑中村長の答弁】
      村内での人的被害は無いが、今年は目撃情報が大きく増加した。
      《詳細》 注意喚起情報について
      ◆ 広報ひがしどおり12月号
      今後も住民の安全確保に努める。
      【田村議員の発言】
      村民の安全・安心が守られるよう期待する。
    `;

    expect(parseStatements(text)).toEqual([
      {
        kind: "question",
        speakerName: "田村",
        speakerRole: "議員",
        content:
          "現在、東通村におけるクマの出没状況と今後の被害対策についてお伺いする。",
        contentHash:
          "794c3e93b425027275197e0ebf535b5c92bc6c3bdaceedae30cc7fce62345f90",
        startOffset: 0,
        endOffset: 35,
      },
      {
        kind: "answer",
        speakerName: "畑中",
        speakerRole: "村長",
        content:
          "村内での人的被害は無いが、今年は目撃情報が大きく増加した。 今後も住民の安全確保に努める。",
        contentHash:
          "59411c8b15a6ad56862149732c4f4df8c4b375d1b2c9f1e909a9941dcafe1e92",
        startOffset: 36,
        endOffset: 81,
      },
      {
        kind: "question",
        speakerName: "田村",
        speakerRole: "議員",
        content: "村民の安全・安心が守られるよう期待する。",
        contentHash:
          "b5b7cb53b93be3e5671448fcf45c10325122bfe640c64f5f62cbaa94b765b1a8",
        startOffset: 82,
        endOffset: 102,
      },
    ]);
  });
});
