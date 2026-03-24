import { describe, it, expect } from "vitest";
import { parseFilename, parseAnchorText, parseListPage } from "./list";

describe("parseFilename", () => {
  it("令和の定例会ファイル名をパースする", () => {
    const result = parseFilename("R07-T09.pdf");
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2025);
    expect(result!.meetingCode).toBe("T");
    expect(result!.number).toBe(9);
  });

  it("令和の予算決算常任委員会ファイル名をパースする", () => {
    const result = parseFilename("R07-YK09.pdf");
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2025);
    expect(result!.meetingCode).toBe("YK");
    expect(result!.number).toBe(9);
  });

  it("令和の臨時会ファイル名をパースする", () => {
    const result = parseFilename("R07-R02.pdf");
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2025);
    expect(result!.meetingCode).toBe("R");
    expect(result!.number).toBe(2);
  });

  it("平成の定例会ファイル名をパースする", () => {
    const result = parseFilename("H31-T03.pdf");
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2019);
    expect(result!.meetingCode).toBe("T");
    expect(result!.number).toBe(3);
  });

  it("平成の臨時会ファイル名をパースする", () => {
    const result = parseFilename("H30-R03.pdf");
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2018);
    expect(result!.meetingCode).toBe("R");
    expect(result!.number).toBe(3);
  });

  it("不正なファイル名は null を返す", () => {
    expect(parseFilename("invalid.pdf")).toBeNull();
    expect(parseFilename("document.pdf")).toBeNull();
  });
});

describe("parseAnchorText", () => {
  it("定例会のアンカーテキストをパースする", () => {
    const result = parseAnchorText(
      "令和6年12月南伊豆町議会定例会.pdf[PDF：1.2MB]"
    );
    expect(result).not.toBeNull();
    expect(result!.section).toBe("12月定例会");
    expect(result!.heldOn).toBe("2024-12-01");
    expect(result!.title).toBe("令和6年12月定例会");
  });

  it("臨時会のアンカーテキストをパースする", () => {
    const result = parseAnchorText(
      "令和7年第2回南伊豆町議会臨時会.pdf[PDF：0.5MB]"
    );
    expect(result).not.toBeNull();
    expect(result!.section).toBe("第2回臨時会");
    expect(result!.heldOn).toBeNull();
    expect(result!.title).toBe("令和7年第2回臨時会");
  });

  it("令和元年の定例会をパースする", () => {
    const result = parseAnchorText("令和元年9月南伊豆町議会定例会.pdf");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-09-01");
  });

  it("委員会のアンカーテキストをパースする", () => {
    const result = parseAnchorText(
      "令和7年9月予算決算常任委員会.pdf[PDF：0.8MB]"
    );
    expect(result).not.toBeNull();
    expect(result!.section).toBe("予算決算常任委員会");
    expect(result!.heldOn).toBe("2025-09-01");
  });

  it("元号がないテキストは null を返す", () => {
    expect(parseAnchorText("議事日程一覧.pdf")).toBeNull();
  });
});

describe("parseListPage", () => {
  const PAGE_URL = "https://www.town.minamiizu.shizuoka.jp/docs/2022012000012/";

  it("定例会の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="file_contents/R06-T12.pdf">令和6年12月南伊豆町議会定例会.pdf[PDF：1.2MB]</a>
        <a href="file_contents/R06-T09.pdf">令和6年9月南伊豆町議会定例会.pdf[PDF：1.0MB]</a>
      </div>
    `;

    const meetings = parseListPage(html, PAGE_URL, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和6年12月定例会");
    expect(meetings[0]!.section).toBe("12月定例会");
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.minamiizu.shizuoka.jp/docs/2022012000012/file_contents/R06-T12.pdf"
    );
    expect(meetings[0]!.filename).toBe("R06-T12.pdf");
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="file_contents/R07-R01.pdf">令和7年第1回南伊豆町議会臨時会.pdf[PDF：0.5MB]</a>
      </div>
    `;

    const meetings = parseListPage(html, PAGE_URL, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("第1回臨時会");
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[0]!.filename).toBe("R07-R01.pdf");
  });

  it("予算決算常任委員会の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="file_contents/R07-YK09.pdf">令和7年9月予算決算常任委員会.pdf[PDF：0.8MB]</a>
      </div>
    `;

    const meetings = parseListPage(html, PAGE_URL, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("予算決算常任委員会");
    expect(meetings[0]!.heldOn).toBe("2025-09-01");
  });

  it("対象年以外はスキップする", () => {
    const html = `
      <div>
        <a href="file_contents/R06-T12.pdf">令和6年12月南伊豆町議会定例会.pdf</a>
        <a href="file_contents/R05-T12.pdf">令和5年12月南伊豆町議会定例会.pdf</a>
      </div>
    `;

    const meetings2024 = parseListPage(html, PAGE_URL, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.filename).toBe("R06-T12.pdf");

    const meetings2023 = parseListPage(html, PAGE_URL, 2023);
    expect(meetings2023).toHaveLength(1);
    expect(meetings2023[0]!.filename).toBe("R05-T12.pdf");
  });

  it("file_contents を含まないリンクはスキップする", () => {
    const html = `
      <div>
        <a href="file_contents/R06-T12.pdf">令和6年12月南伊豆町議会定例会.pdf</a>
        <a href="/other/document.pdf">別のドキュメント</a>
      </div>
    `;

    const meetings = parseListPage(html, PAGE_URL, 2024);
    expect(meetings).toHaveLength(1);
  });

  it("平成期の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="file_contents/H31-T03.pdf">平成31年3月南伊豆町議会定例会.pdf</a>
      </div>
    `;

    const meetings = parseListPage(html, PAGE_URL, 2019);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-03-01");
    expect(meetings[0]!.filename).toBe("H31-T03.pdf");
  });
});
