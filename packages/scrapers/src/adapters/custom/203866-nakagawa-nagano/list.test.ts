import { describe, expect, it } from "vitest";
import { parseDetailPage, parseHeldOn, parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会・臨時会のリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/12426.html">令和7年9月定例会</a></li>
        <li><a href="/site/gikai/12147.html">令和7年6月定例会</a></li>
        <li><a href="/site/gikai/1037.html">平成23年臨時会</a></li>
      </ul>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(3);

    expect(sessions[0]!.detailUrl).toBe(
      "https://www.vill.nakagawa.nagano.jp/site/gikai/12426.html"
    );
    expect(sessions[0]!.sessionTitle).toBe("令和7年9月定例会");
    expect(sessions[0]!.year).toBe(2025);

    expect(sessions[1]!.detailUrl).toBe(
      "https://www.vill.nakagawa.nagano.jp/site/gikai/12147.html"
    );
    expect(sessions[1]!.sessionTitle).toBe("令和7年6月定例会");
    expect(sessions[1]!.year).toBe(2025);

    expect(sessions[2]!.detailUrl).toBe(
      "https://www.vill.nakagawa.nagano.jp/site/gikai/1037.html"
    );
    expect(sessions[2]!.sessionTitle).toBe("平成23年臨時会");
    expect(sessions[2]!.year).toBe(2011);
  });

  it("定例会・臨時会でないリンクはスキップする", () => {
    const html = `
      <a href="/site/gikai/12426.html">令和7年9月定例会</a>
      <a href="/site/gikai/999.html">議会だより</a>
      <a href="/site/top.html">トップページ</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.sessionTitle).toBe("令和7年9月定例会");
  });

  it("全角数字を含むタイトルも正しく年を抽出する", () => {
    const html = `
      <a href="/site/gikai/5000.html">令和４年３月定例会</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.year).toBe(2022);
    // 元のタイトルは全角のまま保持
    expect(sessions[0]!.sessionTitle).toBe("令和４年３月定例会");
  });

  it("令和元年をパースする", () => {
    const html = `
      <a href="/site/gikai/7000.html">令和元年9月定例会</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.year).toBe(2019);
  });

  it("重複する URL はスキップする", () => {
    const html = `
      <a href="/site/gikai/12426.html">令和7年9月定例会</a>
      <a href="/site/gikai/12426.html">令和7年9月定例会（再掲）</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  it("li タグ内の日付と PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>令和7年9月8日<a href="/uploaded/attachment/7695.pdf">会議録（PDF）</a></li>
        <li>令和7年9月9日<a href="/uploaded/attachment/7696.pdf">会議録（PDF）</a></li>
        <li>令和7年9月26日<a href="/uploaded/attachment/7697.pdf">会議録（PDF）</a></li>
      </ul>
    `;

    const records = parseDetailPage(html, "令和7年9月定例会");

    expect(records).toHaveLength(3);

    expect(records[0]!.pdfUrl).toBe(
      "https://www.vill.nakagawa.nagano.jp/uploaded/attachment/7695.pdf"
    );
    expect(records[0]!.heldOnLabel).toBe("令和7年9月8日");
    expect(records[0]!.sessionTitle).toBe("令和7年9月定例会");

    expect(records[1]!.pdfUrl).toBe(
      "https://www.vill.nakagawa.nagano.jp/uploaded/attachment/7696.pdf"
    );
    expect(records[1]!.heldOnLabel).toBe("令和7年9月9日");

    expect(records[2]!.pdfUrl).toBe(
      "https://www.vill.nakagawa.nagano.jp/uploaded/attachment/7697.pdf"
    );
    expect(records[2]!.heldOnLabel).toBe("令和7年9月26日");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>会議録はありません。</p>`;
    expect(parseDetailPage(html, "令和7年9月定例会")).toEqual([]);
  });
});

describe("parseHeldOn", () => {
  it("令和の日付を西暦に変換する", () => {
    expect(parseHeldOn("令和7年9月8日")).toBe("2025-09-08");
  });

  it("令和の日付（月・日が2桁）を正しく変換する", () => {
    expect(parseHeldOn("令和7年9月26日")).toBe("2025-09-26");
  });

  it("平成の日付を西暦に変換する", () => {
    expect(parseHeldOn("平成23年6月15日")).toBe("2011-06-15");
  });

  it("令和元年をパースする", () => {
    expect(parseHeldOn("令和元年3月5日")).toBe("2019-03-05");
  });

  it("全角数字を含む日付をパースする", () => {
    expect(parseHeldOn("令和４年３月８日")).toBe("2022-03-08");
  });

  it("パースできない場合は null を返す", () => {
    expect(parseHeldOn("会議録")).toBeNull();
    expect(parseHeldOn("")).toBeNull();
  });
});
