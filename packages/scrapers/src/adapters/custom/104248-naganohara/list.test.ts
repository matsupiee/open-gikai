import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseLinkDate } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1750300107848/index.html">令和7年会議録</a></li>
        <li><a href="/www/contents/1712127778415/index.html">令和6年会議録</a></li>
        <li><a href="/www/contents/1680488942465/index.html">令和5年会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.naganohara.gunma.jp/www/contents/1750300107848/index.html",
    );
    expect(pages[1]!.label).toBe("令和6年会議録");
    expect(pages[2]!.label).toBe("令和5年会議録");
  });

  it("平成年度のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1565154378519/index.html">平成30年会議録</a></li>
        <li><a href="/www/contents/1456900555108/index.html">令和元年会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.label).toBe("平成30年会議録");
    expect(pages[1]!.label).toBe("令和元年会議録");
  });

  it("年度表記のないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1234567890123/index.html">お知らせ</a></li>
        <li><a href="/www/contents/1750300107848/index.html">令和7年会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年会議録");
  });
});

describe("parseLinkDate", () => {
  it("令和期のリンクテキストから日付を抽出する（全角月）", () => {
    const result = parseLinkDate(
      "令和６年第４回定例会会議録（12月）",
      "https://www.town.naganohara.gunma.jp/www/contents/1712127778415/files/R0612.pdf",
    );
    expect(result).toBe("2024-12-01");
  });

  it("令和元年に対応する", () => {
    const result = parseLinkDate(
      "令和元年第１回定例会会議録（3月）",
      "https://www.town.naganohara.gunma.jp/www/contents/1456900555108/files/R0103.pdf",
    );
    expect(result).toBe("2019-03-01");
  });

  it("平成期のファイル名から日付を推定する（定例会）", () => {
    const result = parseLinkDate(
      "平成27年第1回定例会会議録",
      "https://www.town.naganohara.gunma.jp/www/contents/1565153505008/files/H2703_T.pdf",
    );
    expect(result).toBe("2015-03-01");
  });

  it("平成期のファイル名から日付を推定する（臨時会）", () => {
    const result = parseLinkDate(
      "平成27年第1回臨時会会議録",
      "https://www.town.naganohara.gunma.jp/www/contents/1565153505008/files/H2702_R.pdf",
    );
    expect(result).toBe("2015-02-01");
  });

  it("令和ファイル名から日付を推定する", () => {
    const result = parseLinkDate(
      "令和5年会議録",
      "https://www.town.naganohara.gunma.jp/www/contents/1680488942465/files/R0503.pdf",
    );
    expect(result).toBe("2023-03-01");
  });

  it("日付情報がない場合は null を返す", () => {
    const result = parseLinkDate(
      "その他資料",
      "https://www.town.naganohara.gunma.jp/www/contents/1234567/files/other.pdf",
    );
    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.naganohara.gunma.jp/www/contents/1712127778415/index.html";

  it("令和年度の PDF リンクを正しく抽出する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1712127778415/files/R0603.pdf">令和６年第１回定例会会議録（3月）</a></li>
        <li><a href="/www/contents/1712127778415/files/R0606.pdf">令和６年第２回定例会会議録（6月）</a></li>
        <li><a href="/www/contents/1712127778415/files/R0612.pdf">令和６年第４回定例会会議録（12月）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.title).toBe("令和６年第１回定例会会議録（3月）");
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.naganohara.gunma.jp/www/contents/1712127778415/files/R0603.pdf",
    );

    expect(meetings[1]!.heldOn).toBe("2024-06-01");
    expect(meetings[2]!.heldOn).toBe("2024-12-01");
  });

  it("平成年度の PDF リンクを正しく抽出する（サフィックス種別）", () => {
    const heisei_page_url =
      "https://www.town.naganohara.gunma.jp/www/contents/1565153505008/index.html";
    const html = `
      <ul>
        <li><a href="/www/contents/1565153505008/files/H2703_T.pdf">平成27年3月定例会会議録</a></li>
        <li><a href="/www/contents/1565153505008/files/H2702_R.pdf">平成27年2月臨時会会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, heisei_page_url);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.heldOn).toBe("2015-03-01");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.heldOn).toBe("2015-02-01");
    expect(meetings[1]!.meetingType).toBe("extraordinary");
  });

  it("日付情報のないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1712127778415/files/R0603.pdf">令和６年第１回定例会会議録（3月）</a></li>
        <li><a href="/www/contents/1712127778415/files/index.pdf">目次</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });
});
