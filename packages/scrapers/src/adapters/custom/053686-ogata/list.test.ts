import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage, extractMeetingId } from "./list";

describe("parseListPage", () => {
  it("指定年度の会議リンクを抽出する（絶対URL）", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250310144400">令和6年第8回（12月）定例会　会議録</a></li>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250115135131">令和6年第7回（9月）定例会　会議録</a></li>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20240301093602">令和5年第4回（12月）定例会　会議録</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2024);

    expect(links).toHaveLength(2);
    expect(links[0]!.title).toBe("令和6年第8回（12月）定例会 会議録");
    expect(links[0]!.url).toBe(
      "https://www.vill.ogata.akita.jp/archive/p20250310144400",
    );
    expect(links[1]!.title).toBe("令和6年第7回（9月）定例会 会議録");
  });

  it("相対 URL でも抽出できる", () => {
    const html = `
      <ul>
        <li><a href="/archive/p20250310144400">令和6年第8回（12月）定例会　会議録</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2024);

    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe(
      "https://www.vill.ogata.akita.jp/archive/p20250310144400",
    );
  });

  it("臨時会のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250310145228">令和6年第9回（12月）臨時会　会議録</a></li>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250310144400">令和6年第8回（12月）定例会　会議録</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2024);

    expect(links).toHaveLength(2);
    expect(links[0]!.title).toContain("臨時会");
    expect(links[1]!.title).toContain("定例会");
  });

  it("旧形式 URL（contents-{番号}）も抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.ogata.akita.jp/archive/contents-169">令和4年第2回（3月）定例会</a></li>
        <li><a href="https://www.vill.ogata.akita.jp/archive/contents-168">令和4年第1回（1月）臨時会</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2022);

    expect(links).toHaveLength(2);
    expect(links[0]!.url).toBe(
      "https://www.vill.ogata.akita.jp/archive/contents-169",
    );
    expect(links[1]!.url).toBe(
      "https://www.vill.ogata.akita.jp/archive/contents-168",
    );
  });

  it("対象年度外のリンクは含まない", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250310144400">令和6年第8回（12月）定例会　会議録</a></li>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20240301093602">令和5年第4回（12月）定例会　会議録</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2023);

    expect(links).toHaveLength(1);
    expect(links[0]!.title).toContain("令和5年");
  });

  it("令和元年に対応する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20190910000000">令和元年第3回（9月）定例会　会議録</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2019);

    expect(links).toHaveLength(1);
    expect(links[0]!.title).toContain("令和元年");
  });

  it("定例会・臨時会以外のリンクは含まない", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250310144400">お知らせ</a></li>
        <li><a href="https://www.vill.ogata.akita.jp/archive/p20250310145228">令和6年第9回（12月）臨時会　会議録</a></li>
      </ul>
    `;

    const links = parseListPage(html, 2024);

    expect(links).toHaveLength(1);
    expect(links[0]!.title).toContain("臨時会");
  });
});

describe("parseDetailPage", () => {
  it("本会議 PDF と委員会 PDF を区別して抽出する", () => {
    const html = `
      <div>
        <h2>本会議</h2>
        <a href="/uploads/public/archive_0000005086_00/%E7%9B%AE%E6%AC%A1_R0612%E5%AE%9A%E4%BE%8B.pdf">目次</a>
        <a href="/uploads/public/archive_0000005086_00/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC8%E5%9B%9E%EF%BC%8812%E6%9C%88%EF%BC%89%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和6年第8回（12月）定例会</a>
        <h2>委員会</h2>
        <a href="/uploads/public/archive_0000005086_00/%E4%BB%A4%E5%92%8C6%E5%B9%B412%E6%9C%88%E5%AE%9A%E4%BE%8B_%E7%B7%8F%E5%8B%99%E7%A6%8F%E7%A5%89%E6%95%99%E8%82%B2%E5%A7%94%E5%93%A1%E4%BC%9A.pdf">総務福祉教育委員会</a>
      </div>
    `;

    const result = parseDetailPage(html);

    expect(result.mainPdfUrl).toBe(
      "https://www.vill.ogata.akita.jp/uploads/public/archive_0000005086_00/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC8%E5%9B%9E%EF%BC%8812%E6%9C%88%EF%BC%89%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf",
    );
    expect(result.committeePdfUrls).toHaveLength(1);
    expect(result.committeePdfUrls[0]).toContain("archive_0000005086_00");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <div>
        <a href="/uploads/public/archive_0000005086_00/%E7%9B%AE%E6%AC%A1_R0612%E5%AE%9A%E4%BE%8B.pdf">目次_R0612定例</a>
        <a href="/uploads/public/archive_0000005086_00/%E4%BC%9A%E8%AD%B0%E9%8C%B2.pdf">会議録本文</a>
      </div>
    `;

    const result = parseDetailPage(html);

    expect(result.mainPdfUrl).toContain("archive_0000005086_00");
    expect(result.mainPdfUrl).toContain("%E4%BC%9A%E8%AD%B0%E9%8C%B2.pdf");
  });

  it("PDF がない場合は null を返す", () => {
    const html = `<div><p>準備中です</p></div>`;

    const result = parseDetailPage(html);

    expect(result.mainPdfUrl).toBeNull();
    expect(result.committeePdfUrls).toHaveLength(0);
  });

  it("臨時会は委員会 PDF がない", () => {
    const html = `
      <div>
        <a href="/uploads/public/archive_0000005089_00/%E7%9B%AE%E6%AC%A1_R0612%E8%87%A8%E6%99%82.pdf">目次_R0612臨時</a>
        <a href="/uploads/public/archive_0000005089_00/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC9%E5%9B%9E%EF%BC%8812%E6%9C%88%EF%BC%89%E8%87%A8%E6%99%82%E4%BC%9A.pdf">令和6年第9回（12月）臨時会</a>
      </div>
    `;

    const result = parseDetailPage(html);

    expect(result.mainPdfUrl).not.toBeNull();
    expect(result.committeePdfUrls).toHaveLength(0);
  });
});

describe("extractMeetingId", () => {
  it("タイムスタンプ形式の URL から ID を抽出する", () => {
    expect(
      extractMeetingId(
        "https://www.vill.ogata.akita.jp/archive/p20250310144400",
      ),
    ).toBe("p20250310144400");
  });

  it("旧形式 URL から ID を抽出する", () => {
    expect(
      extractMeetingId(
        "https://www.vill.ogata.akita.jp/archive/contents-168",
      ),
    ).toBe("contents-168");
  });

  it("サフィックス付き URL から ID を抽出する", () => {
    expect(
      extractMeetingId(
        "https://www.vill.ogata.akita.jp/archive/p20230119114416-1",
      ),
    ).toBe("p20230119114416-1");
  });
});
