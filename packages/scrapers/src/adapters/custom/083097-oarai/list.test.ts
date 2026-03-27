import { describe, expect, it } from "vitest";
import { parseSessionsFromHtml, extractDayLabel, extractFileName } from "./list";

describe("parseSessionsFromHtml", () => {
  it("指定年のセッションから PDF リンクを抽出する", () => {
    const html = `
      <h4>令和6年第4回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/目次-1.pdf">目次</a>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/%ef%bc%91%e6%97%a5%e7%9b%ae%ef%bc%8812%e6%9c%883%e6%97%a5%ef%bc%89.pdf">１日目（12月3日）</a>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/%ef%bc%92%e6%97%a5%e7%9b%ae%ef%bc%8812%e6%9c%884%e6%97%a5%ef%bc%89.pdf">２日目（12月4日）</a>
      </p>
      <h4>令和5年第4回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2024/03/other.pdf">１日目（12月5日）</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2024);

    expect(records).toHaveLength(2);
    expect(records[0]!.title).toBe("令和6年第4回議会定例会");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[1]!.title).toBe("令和6年第4回議会定例会");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <h4>令和6年第4回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/目次-1.pdf">目次</a>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/1day.pdf">１日目（12月3日）</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.dayLabel).toBe("12月3日");
  });

  it("臨時会の meetingType は extraordinary になる", () => {
    const html = `
      <h4>令和6年第1回議会臨時会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2024/05/1day.pdf">１日目（5月10日）</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("対象年以外のセッションはスキップする", () => {
    const html = `
      <h4>令和5年第4回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2024/03/1day.pdf">１日目（12月5日）</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2024);

    expect(records).toHaveLength(0);
  });

  it("令和元年のセッションも処理できる", () => {
    const html = `
      <h4>令和元年第4回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2020/01/1day.pdf">１日目（12月5日）</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2019);

    expect(records).toHaveLength(1);
    expect(records[0]!.title).toBe("令和元年第4回議会定例会");
  });

  it("全角数字を含む会議名も処理できる", () => {
    const html = `
      <h4>令和６年第４回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/1day.pdf">１日目（12月3日）</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.title).toBe("令和６年第４回議会定例会");
  });

  it("重複 URL はスキップする", () => {
    const html = `
      <h4>令和6年第4回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/1day.pdf">１日目（12月3日）</a>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/1day.pdf">ダウンロード</a>
      </p>
    `;

    const records = parseSessionsFromHtml(html, 2024);

    expect(records).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中</p></div>`;
    const records = parseSessionsFromHtml(html, 2024);
    expect(records).toHaveLength(0);
  });

  it("古いセッション（p > strong タグ）からも PDF リンクを抽出できる", () => {
    // 令和5年第3回以前は <p><strong>...</strong></p> 形式を使用
    const html = `
      <p class="has-background"><strong>令和3年第１回議会定例会</strong></p>
      <div class="wp-block-file"><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/目次.pdf">目次</a><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/目次.pdf" class="wp-block-file__button" download>ダウンロード</a></div>
      <div class="wp-block-file"><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/１日目（3月8日）.pdf">１日目（3月8日）</a><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/１日目（3月8日）.pdf" class="wp-block-file__button" download>ダウンロード</a></div>
      <div class="wp-block-file"><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/２日目（3月10日）.pdf">２日目（3月10日）</a><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/２日目（3月10日）.pdf" class="wp-block-file__button" download>ダウンロード</a></div>
    `;

    const records = parseSessionsFromHtml(html, 2021);

    expect(records).toHaveLength(2);
    expect(records[0]!.title).toBe("令和3年第１回議会定例会");
    expect(records[0]!.dayLabel).toBe("3月8日");
    expect(records[1]!.dayLabel).toBe("3月10日");
  });

  it("h4 と p > strong が混在するページでも両方のセッションを抽出できる", () => {
    // 新しいセッションは h4、古いセッションは p > strong
    const html = `
      <h4>令和５年第４回議会定例会</h4>
      <p>
        <a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2024/01/new.pdf">１日目（12月5日）</a>
      </p>
      <p class="has-background"><strong>令和3年第１回議会定例会</strong></p>
      <div class="wp-block-file"><a href="https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2021/07/old.pdf">１日目（3月8日）</a></div>
    `;

    const records2023 = parseSessionsFromHtml(html, 2023);
    expect(records2023).toHaveLength(1);
    expect(records2023[0]!.title).toBe("令和５年第４回議会定例会");

    const records2021 = parseSessionsFromHtml(html, 2021);
    expect(records2021).toHaveLength(1);
    expect(records2021[0]!.title).toBe("令和3年第１回議会定例会");
  });
});

describe("extractDayLabel", () => {
  it("全角括弧から日付を抽出する", () => {
    expect(extractDayLabel("１日目（12月3日）")).toBe("12月3日");
  });

  it("半角括弧から日付を抽出する", () => {
    expect(extractDayLabel("1日目(12月22日)")).toBe("12月22日");
  });

  it("全角数字の括弧内を抽出する", () => {
    expect(extractDayLabel("１日目（１２月３日）")).toBe("12月3日");
  });

  it("括弧がない場合はラベルそのままを返す", () => {
    expect(extractDayLabel("目次")).toBe("目次");
  });
});

describe("extractFileName", () => {
  it("URLからファイル名を抽出する", () => {
    const url =
      "https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/1%E6%97%A5%E7%9B%AE%EF%BC%8812%E6%9C%883%E6%97%A5%EF%BC%89.pdf";
    expect(extractFileName(url)).toBe("1日目（12月3日）");
  });

  it("エンコードされていないファイル名もそのまま抽出する", () => {
    const url =
      "https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/2025/06/meeting.pdf";
    expect(extractFileName(url)).toBe("meeting");
  });
});
