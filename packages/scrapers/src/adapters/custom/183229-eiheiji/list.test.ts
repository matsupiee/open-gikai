import { describe, it, expect } from "vitest";
import {
  parseMinutesPage,
  parseDetailPage,
  extractDateFromText,
  extractDateFromFilename,
} from "./list";

describe("parseMinutesPage", () => {
  it("会議リンクを正しく抽出する（strong タグを含む）", () => {
    const html = `
      <ul>
        <li><a href="/assembly/minutes/rinnji0801"><strong>令和8年1月臨時会</strong></a></li>
        <li><a href="/assembly/minutes/teirei07012-2"><strong>令和7年12月定例会</strong></a></li>
        <li><a href="/assembly/minutes/teirei0612"><strong>令和6年12月定例会</strong></a></li>
      </ul>
    `;

    const meetings = parseMinutesPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.meetingId).toBe("rinnji0801");
    expect(meetings[0]!.title).toBe("令和8年1月臨時会");
    expect(meetings[1]!.meetingId).toBe("teirei07012-2");
    expect(meetings[1]!.title).toBe("令和7年12月定例会");
    expect(meetings[2]!.meetingId).toBe("teirei0612");
    expect(meetings[2]!.title).toBe("令和6年12月定例会");
  });

  it("assembly/minutes 以外のリンクはスキップする", () => {
    const html = `
      <a href="/about">議会について</a>
      <a href="/assembly/minutes/teirei0612">令和6年12月定例会</a>
      <a href="/news/123">お知らせ</a>
    `;

    const meetings = parseMinutesPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingId).toBe("teirei0612");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseMinutesPage("")).toEqual([]);
  });
});

describe("extractDateFromText", () => {
  it("令和の全角日付をパースする", () => {
    expect(extractDateFromText("令和８年１月２１日")).toBe("2026-01-21");
  });

  it("令和の半角日付をパースする", () => {
    expect(extractDateFromText("令和7年12月2日")).toBe("2025-12-02");
  });

  it("平成の日付をパースする", () => {
    expect(extractDateFromText("平成28年3月15日")).toBe("2016-03-15");
  });

  it("令和元年をパースする", () => {
    expect(extractDateFromText("令和元年５月１日")).toBe("2019-05-01");
  });

  it("平成元年をパースする", () => {
    expect(extractDateFromText("平成元年３月１５日")).toBe("1989-03-15");
  });

  it("日付がないテキストは null を返す", () => {
    expect(extractDateFromText("表紙")).toBeNull();
  });
});

describe("extractDateFromFilename", () => {
  it("R + 和暦年月日パターンを変換する", () => {
    expect(extractDateFromFilename("R071202.pdf")).toBe("2025-12-02");
  });

  it("H + 和暦年月日パターンを変換する", () => {
    expect(extractDateFromFilename("H280315.pdf")).toBe("2016-03-15");
  });

  it("マッチしない場合は null を返す", () => {
    expect(extractDateFromFilename("index.pdf")).toBeNull();
  });
});

describe("parseDetailPage", () => {
  it("本文 PDF リンクを抽出し表紙・目次はスキップする", () => {
    const html = `
      <div>
        <a href="/files/admin/rinnji0801/abc123.pdf">表紙</a>
        <a href="/files/admin/rinnji0801/def456.pdf">目次</a>
        <a href="/files/admin/rinnji0801/R080121.pdf">令和８年１月２１日</a>
      </div>
    `;

    const meetings = parseDetailPage(html, "rinnji0801", "令和8年1月臨時会");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.eiheiji-gikai.jp/files/admin/rinnji0801/R080121.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2026-01-21");
    expect(meetings[0]!.title).toBe("令和8年1月臨時会");
    expect(meetings[0]!.meetingId).toBe("rinnji0801");
  });

  it("複数の本文 PDF を抽出する", () => {
    const html = `
      <div>
        <a href="/files/admin/teirei0612/R061202.pdf">令和６年１２月２日</a>
        <a href="/files/admin/teirei0612/R061210.pdf">令和６年１２月１０日</a>
        <a href="/files/admin/teirei0612/R061218.pdf">令和６年１２月１８日</a>
      </div>
    `;

    const meetings = parseDetailPage(html, "teirei0612", "令和6年12月定例会");

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-12-02");
    expect(meetings[1]!.heldOn).toBe("2024-12-10");
    expect(meetings[2]!.heldOn).toBe("2024-12-18");
  });

  it("議事日程リンクはスキップする", () => {
    const html = `
      <a href="/files/admin/teirei0612/schedule.pdf">議事日程</a>
      <a href="/files/admin/teirei0612/R061202.pdf">令和６年１２月２日</a>
    `;

    const meetings = parseDetailPage(html, "teirei0612", "令和6年12月定例会");
    expect(meetings).toHaveLength(1);
  });

  it("リンクテキストに日付がない場合、ファイル名からフォールバックする", () => {
    const html = `
      <a href="/files/admin/teirei0612/R061202.pdf">本会議 第1日</a>
    `;

    const meetings = parseDetailPage(html, "teirei0612", "令和6年12月定例会");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-02");
  });

  it("ハッシュファイル名でもリンクテキスト内の R コードから日付を抽出する", () => {
    const html = `
      <a href="/files/admin/teirei0703-1/038befaa2065e794866a674713b649aa.pdf">永平寺町令和７年第２回定例会（表紙）.pdf</a>
      <a href="/files/admin/teirei0703-1/b73820e5f5ebfad92fe4ee85493ca7e5.pdf">永平寺町令和７年第２回定例会（目次）.pdf</a>
      <a href="/files/admin/teirei0703-1/aab5b850321b3d7949247c113e738e6e.pdf">永平寺町令和７年第２回定例会R070225.pdf</a>
      <a href="/files/admin/teirei0703-1/ae5bbff3a82d15226687ce249d31be4e.pdf">永平寺町令和７年第２回定例会R070304.pdf</a>
    `;

    const meetings = parseDetailPage(html, "teirei0703-1", "令和7年3月定例会");

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-02-25");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.eiheiji-gikai.jp/files/admin/teirei0703-1/aab5b850321b3d7949247c113e738e6e.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2025-03-04");
  });

  it("日付が判別できないリンクはスキップする", () => {
    const html = `
      <a href="/files/admin/teirei0612/unknown.pdf">資料</a>
    `;

    const meetings = parseDetailPage(html, "teirei0612", "令和6年12月定例会");
    expect(meetings).toHaveLength(0);
  });
});
