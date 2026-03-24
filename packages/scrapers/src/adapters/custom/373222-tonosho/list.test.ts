import { describe, it, expect } from "vitest";
import { parseReiwaIndexPage, parseMeetingPage, parseLegacyYearPage } from "./list";

const BASE_INDEX_URL =
  "https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa7/index.html";
const BASE_MEETING_URL =
  "https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa7/7_6gatu.html";
const BASE_LEGACY_URL =
  "https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/218.html";

describe("parseReiwaIndexPage", () => {
  it("会議別ページリンクを抽出する", () => {
    const html = `
      <div>
        <ul>
          <li><a href="7_6gatu.html">6月定例会の会議録</a></li>
          <li><a href="7_9gatu.html">9月定例会の会議録</a></li>
          <li><a href="7_12gatu.html">12月定例会の会議録</a></li>
        </ul>
      </div>
    `;

    const results = parseReiwaIndexPage(html, BASE_INDEX_URL);

    expect(results).toHaveLength(3);
    expect(results[0]!.url).toBe(
      "https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa7/7_6gatu.html"
    );
    expect(results[0]!.meetingName).toBe("6月定例会の会議録");
    expect(results[1]!.meetingName).toBe("9月定例会の会議録");
    expect(results[2]!.meetingName).toBe("12月定例会の会議録");
  });

  it("臨時会リンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="7_1gatu.html">1月臨時会の会議録</a></li>
        <li><a href="7_3gatu.html">3月定例会の会議録</a></li>
      </ul>
    `;

    const results = parseReiwaIndexPage(html, BASE_INDEX_URL);
    expect(results).toHaveLength(2);
    expect(results[0]!.meetingName).toBe("1月臨時会の会議録");
    expect(results[1]!.meetingName).toBe("3月定例会の会議録");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="index.html">戻る</a></li>
        <li><a href="7_6gatu.html">6月定例会の会議録</a></li>
      </ul>
    `;

    const results = parseReiwaIndexPage(html, BASE_INDEX_URL);
    expect(results).toHaveLength(1);
    expect(results[0]!.meetingName).toBe("6月定例会の会議録");
  });

  it("絶対 URL のリンクをそのまま返す", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa7/7_6gatu.html">6月定例会の会議録</a></li>
      </ul>
    `;

    const results = parseReiwaIndexPage(html, BASE_INDEX_URL);
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe(
      "https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa7/7_6gatu.html"
    );
  });
});

describe("parseMeetingPage", () => {
  it("全文・一般質問・委員長報告の PDF リンクを h2/h3 ラベルとともに抽出する", () => {
    const html = `
      <h1>6月定例会の会議録</h1>
      <h2>全文</h2>
        <h3>6月10日</h3>
          <ul><li><a href="/material/files/group/13/gikai7-6-1.pdf">全文1</a></li></ul>
        <h3>6月11日</h3>
          <ul><li><a href="/material/files/group/13/gikai7-6-2.pdf">全文2</a></li></ul>
      <h2>一般質問</h2>
        <h3>山田太郎</h3>
          <ul><li><a href="/material/files/group/13/ipan7-6-1.pdf">一般質問</a></li></ul>
        <h3>田中花子</h3>
          <ul><li><a href="/material/files/group/13/ipan7-6-2.pdf">一般質問</a></li></ul>
      <h2>委員長報告</h2>
        <h3>総務委員会</h3>
          <ul><li><a href="/material/files/group/13/houkoku7-6-1.pdf">委員長報告</a></li></ul>
    `;

    const { pdfLinks } = parseMeetingPage(html, BASE_MEETING_URL);

    expect(pdfLinks).toHaveLength(5);

    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.tonosho.kagawa.jp/material/files/group/13/gikai7-6-1.pdf"
    );
    expect(pdfLinks[0]!.h2Label).toBe("全文");
    expect(pdfLinks[0]!.h3Label).toBe("6月10日");

    expect(pdfLinks[1]!.url).toBe(
      "https://www.town.tonosho.kagawa.jp/material/files/group/13/gikai7-6-2.pdf"
    );
    expect(pdfLinks[1]!.h2Label).toBe("全文");
    expect(pdfLinks[1]!.h3Label).toBe("6月11日");

    expect(pdfLinks[2]!.h2Label).toBe("一般質問");
    expect(pdfLinks[2]!.h3Label).toBe("山田太郎");

    expect(pdfLinks[3]!.h2Label).toBe("一般質問");
    expect(pdfLinks[3]!.h3Label).toBe("田中花子");

    expect(pdfLinks[4]!.h2Label).toBe("委員長報告");
    expect(pdfLinks[4]!.h3Label).toBe("総務委員会");
  });

  it("閉会中の委員会活動報告も収集する", () => {
    const html = `
      <h2>閉会中の委員会活動報告</h2>
        <h3>産業建設委員会</h3>
          <ul><li><a href="/material/files/group/13/report.pdf">活動報告</a></li></ul>
    `;

    const { pdfLinks } = parseMeetingPage(html, BASE_MEETING_URL);

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.h2Label).toBe("閉会中の委員会活動報告");
    expect(pdfLinks[0]!.h3Label).toBe("産業建設委員会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h1>6月定例会の会議録</h1>
      <p>会議録はありません。</p>
    `;

    const { pdfLinks } = parseMeetingPage(html, BASE_MEETING_URL);
    expect(pdfLinks).toHaveLength(0);
  });
});

describe("parseLegacyYearPage", () => {
  it("h3 の会議名と PDF リンクを対応付ける", () => {
    const html = `
      <div>
        <h3>3月定例会</h3>
        <a href="/material/files/group/13/218_1.pdf">3月1日</a>
        <a href="/material/files/group/13/218_2.pdf">3月2日</a>
        <h3>6月定例会</h3>
        <a href="/material/files/group/13/218_3.pdf">6月15日</a>
      </div>
    `;

    const results = parseLegacyYearPage(html, BASE_LEGACY_URL, 2011);

    expect(results).toHaveLength(3);

    expect(results[0]!.meetingName).toBe("3月定例会");
    expect(results[0]!.heldOn).toBe("2011-03-01");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.tonosho.kagawa.jp/material/files/group/13/218_1.pdf"
    );

    expect(results[1]!.meetingName).toBe("3月定例会");
    expect(results[1]!.heldOn).toBe("2011-03-01");

    expect(results[2]!.meetingName).toBe("6月定例会");
    expect(results[2]!.heldOn).toBe("2011-06-01");
    expect(results[2]!.pdfUrl).toBe(
      "https://www.town.tonosho.kagawa.jp/material/files/group/13/218_3.pdf"
    );
  });

  it("臨時会も収集する", () => {
    const html = `
      <h3>1月臨時会</h3>
      <a href="/material/files/group/13/rinji.pdf">1月10日</a>
    `;

    const results = parseLegacyYearPage(html, BASE_LEGACY_URL, 2020);
    expect(results).toHaveLength(1);
    expect(results[0]!.meetingName).toBe("1月臨時会");
    expect(results[0]!.heldOn).toBe("2020-01-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>会議録はありません。</p>`;
    const results = parseLegacyYearPage(html, BASE_LEGACY_URL, 2011);
    expect(results).toHaveLength(0);
  });

  it("HTTP URL を HTTPS に変換する", () => {
    const html = `
      <h3>6月定例会</h3>
      <a href="http://www.town.tonosho.kagawa.jp/material/files/group/13/old.pdf">6月10日</a>
    `;

    const results = parseLegacyYearPage(html, BASE_LEGACY_URL, 2020);
    expect(results[0]!.pdfUrl).toMatch(/^https:\/\//);
  });
});
