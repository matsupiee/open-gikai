import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseWarekiDate, parseWarekiYear, toHalfWidth } from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("令和６年")).toBe("令和6年");
    expect(toHalfWidth("令和８年１月22日")).toBe("令和8年1月22日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("令和6年")).toBe("令和6年");
  });
});

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和8年")).toBe(2026);
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年")).toBe(2019);
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成元年")).toBe(1989);
  });

  it("全角数字の年を変換する", () => {
    expect(parseWarekiYear("令和６年")).toBe(2024);
    expect(parseWarekiYear("令和８年")).toBe(2026);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("議会だより")).toBeNull();
  });
});

describe("parseWarekiDate", () => {
  it("令和の日付を変換する", () => {
    expect(parseWarekiDate("令和8年1月22日")).toBe("2026-01-22");
    expect(parseWarekiDate("令和6年10月24日")).toBe("2024-10-24");
    expect(parseWarekiDate("令和元年5月23日")).toBe("2019-05-23");
  });

  it("平成の日付を変換する", () => {
    expect(parseWarekiDate("平成31年4月25日")).toBe("2019-04-25");
    expect(parseWarekiDate("平成30年1月25日")).toBe("2018-01-25");
  });

  it("全角数字の日付を変換する", () => {
    expect(parseWarekiDate("令和６年１０月24日")).toBe("2024-10-24");
    expect(parseWarekiDate("令和８年１月22日")).toBe("2026-01-22");
  });

  it("日が省略された場合は 01 を使用する", () => {
    expect(parseWarekiDate("令和6年10月")).toBe("2024-10-01");
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiDate("議会だより")).toBeNull();
    expect(parseWarekiDate("2024-01-01")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("通常号の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a target="_blank" href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou183.pdf">
            議会だより第183号　令和８年１月22日発行（1,841.4kbyte）
          </a>
        </li>
        <li>
          <a target="_blank" href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou178.pdf">
            議会だより第178号　令和６年10月24日発行（1,336.1kbyte）
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html, "documents/gikaidayori");

    expect(result).toHaveLength(2);
    expect(result[0]!.issueNumber).toBe(183);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou183.pdf",
    );
    expect(result[0]!.issuedOn).toBe("2026-01-22");
    expect(result[0]!.year).toBe(2026);
    expect(result[1]!.issueNumber).toBe(178);
    expect(result[1]!.issuedOn).toBe("2024-10-24");
    expect(result[1]!.year).toBe(2024);
  });

  it("号外の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a target="_blank" href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou_gougai2.pdf">
            議会だより号外　　　令和６年11月28日発行（641.9kbyte）
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html, "documents/gikaidayori");

    expect(result).toHaveLength(1);
    expect(result[0]!.issueNumber).toBeNull();
    expect(result[0]!.pdfUrl).toContain("gikaihou_gougai2.pdf");
    expect(result[0]!.issuedOn).toBe("2024-11-28");
    expect(result[0]!.year).toBe(2024);
  });

  it("href が空のリンクはスキップする", () => {
    const html = `
      <ul>
        <li>
          <a target="_blank" href="">
            議会だより第180号　令和7年4月発行
          </a>
        </li>
        <li>
          <a target="_blank" href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou179.pdf">
            議会だより第179号　令和７年１月23日発行（2,592.5kbyte）
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html, "documents/gikaidayori");

    expect(result).toHaveLength(1);
    expect(result[0]!.issueNumber).toBe(179);
  });

  it("発行日が解析できないリンクはスキップする", () => {
    const html = `
      <ul>
        <li>
          <a href="/okuwa/some/other.pdf">その他資料</a>
        </li>
        <li>
          <a href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou183.pdf">
            議会だより第183号　令和８年１月22日発行（1,841.4kbyte）
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html, "documents/gikaidayori");

    expect(result).toHaveLength(1);
    expect(result[0]!.issueNumber).toBe(183);
  });

  it("平成の号を正しくパースする", () => {
    const html = `
      <ul>
        <li>
          <a href="/okuwa/gikai/gikaidayori/documents/gikaidayori_2/gikaidayori131.pdf">
            議会だより第131号　平成25年1月24日発行
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html, "documents/gikaidayori_2");

    expect(result).toHaveLength(1);
    expect(result[0]!.issueNumber).toBe(131);
    expect(result[0]!.issuedOn).toBe("2013-01-24");
    expect(result[0]!.year).toBe(2013);
  });

  it("複数のリンクを正しくパースする", () => {
    const html = `
      <ul>
        <li>
          <a href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikai_175.pdf">
            議会だより第175号　令和6年1月25日発行（1,948kbyte）
          </a>
        </li>
        <li>
          <a href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikai_174.pdf">
            議会だより第174号　令和5年10月26日発行（1,566.4kbyte）
          </a>
        </li>
        <li>
          <a href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikai_gougai.pdf">
            議会だより号外　　　令和5年5月25日発行（294.1kbyte）
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html, "documents/gikaidayori");

    expect(result).toHaveLength(3);
    expect(result[0]!.issueNumber).toBe(175);
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.issueNumber).toBe(174);
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.issueNumber).toBeNull();
    expect(result[2]!.year).toBe(2023);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("", "documents/gikaidayori")).toEqual([]);
  });

  it("PDF リンクがない HTML は空配列を返す", () => {
    const html = `<ul><li><p>会議録はありません。</p></li></ul>`;
    expect(parseListPage(html, "documents/gikaidayori")).toEqual([]);
  });
});
