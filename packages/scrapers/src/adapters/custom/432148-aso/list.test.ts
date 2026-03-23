import { describe, it, expect } from "vitest";
import { parseYearPage, parseSessionDate, parseLinkDate } from "./list";

describe("parseSessionDate", () => {
  it("令和の日付をパースする", () => {
    expect(parseSessionDate("会期：令和7年5月30日")).toBe("2025-05-30");
  });

  it("令和元年をパースする", () => {
    expect(parseSessionDate("会期：令和元年6月14日")).toBe("2019-06-14");
  });

  it("平成の日付をパースする", () => {
    expect(parseSessionDate("会期：平成30年8月31日～9月21日")).toBe(
      "2018-08-31"
    );
  });

  it("日付がない場合は null を返す", () => {
    expect(parseSessionDate("第6回 定例会")).toBeNull();
  });
});

describe("parseLinkDate", () => {
  it("月日パターンを解析する", () => {
    expect(parseLinkDate("12月 3日　議案質疑・委員会付託", "2018-08-31")).toBe(
      "2018-12-03"
    );
  });

  it("スペースなしの月日パターンを解析する", () => {
    expect(
      parseLinkDate("6月14日　一般質問", "2018-06-01")
    ).toBe("2018-06-14");
  });

  it("日付がないリンクテキストは null を返す", () => {
    expect(parseLinkDate("目次", "2025-05-30")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("会議録 PDF リンクを抽出し、議案一覧等は除外する", () => {
    const html = `
      <h3>令和7年 第4回 定例会</h3>
      <h4>会期：令和7年5月30日</h4>
      <a href="/files/uploads/2025/05/202506_giann.pdf">議案一覧[100KB]</a>
      <a href="/files/uploads/2025/06/R7_teirei_vol4_question_list.pdf">一般質問通告書[134KB]</a>
      <a href="/files/uploads/2025/06/R7_vol4_teirei_deliberation_result.pdf">審議結果[286KB]</a>
      <a href="/files/uploads/2026/02/R7_vol4_teirei_mokuji.pdf">目次[232KB]</a>
      <a href="/files/uploads/2026/02/R7_Vol4_teirei_opening.pdf">開会・諸般の報告・提案理由の説明[455KB]</a>
      <a href="/files/uploads/2026/02/R7_vol4_teirei_question_0602.pdf">6月 2日　議案質疑[300KB]</a>
      <a href="/files/uploads/2026/02/R7_vol4_teirei_question_report.pdf">委員長報告・質疑・討論・採決[400KB]</a>
      <a href="/files/uploads/2026/02/R7_vol4_teirei_general_question_1st.pdf">一般質問（1日目）[500KB]</a>
      <a href="/files/uploads/2026/02/R7_vol4_teirei_general_question_2nd.pdf">一般質問（2日目）[600KB]</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(6);
    expect(meetings[0]!.title).toBe("令和7年 第4回 定例会 目次");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.aso.kumamoto.jp/files/uploads/2026/02/R7_vol4_teirei_mokuji.pdf"
    );
    expect(meetings[0]!.sessionName).toBe("令和7年 第4回 定例会");
    expect(meetings[0]!.heldOn).toBe("2025-05-30");

    expect(meetings[1]!.title).toBe(
      "令和7年 第4回 定例会 開会・諸般の報告・提案理由の説明"
    );

    expect(meetings[2]!.title).toBe(
      "令和7年 第4回 定例会 6月 2日　議案質疑"
    );
    expect(meetings[2]!.heldOn).toBe("2025-06-02");

    expect(meetings[3]!.title).toBe(
      "令和7年 第4回 定例会 委員長報告・質疑・討論・採決"
    );

    expect(meetings[4]!.title).toBe(
      "令和7年 第4回 定例会 一般質問（1日目）"
    );
    expect(meetings[5]!.title).toBe(
      "令和7年 第4回 定例会 一般質問（2日目）"
    );
  });

  it("臨時会の議事録を抽出する", () => {
    const html = `
      <h3>令和7年 第3回 臨時会</h3>
      <h4>会期：令和7年4月28日</h4>
      <a href="/files/uploads/2025/04/gian_R704.pdf">議案一覧[50KB]</a>
      <a href="/files/uploads/2025/05/R7_vol3_rinji_deliberation_result.pdf">審議結果[80KB]</a>
      <a href="/files/uploads/2025/08/r7_vol3_rinji_report_discuss_vote.pdf">議事録[200KB]</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年 第3回 臨時会 議事録");
    expect(meetings[0]!.sessionName).toBe("令和7年 第3回 臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-04-28");
  });

  it("平成30年の会議録を抽出する", () => {
    const html = `
      <h3>第4回 定例会</h3>
      <h4>会期：平成30年8月31日～9月21日</h4>
      <a href="/files/uploads/2023/06/bill_list_h3009.pdf">議案一覧[100KB]</a>
      <a href="/files/uploads/2023/06/eliberation_result_h3009.pdf">審議結果[80KB]</a>
      <a href="/files/uploads/2019/02/h3009_teirei_mokuji.pdf">目次[50KB]</a>
      <a href="/files/uploads/2019/05/h3009_teirei_0831-2.pdf">8月31日　開会・諸般の報告・提案理由の説明[300KB]</a>
      <a href="/files/uploads/2019/05/h3009_teirei_0903-2.pdf">9月 3日　議案質疑[250KB]</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("第4回 定例会 目次");
    expect(meetings[0]!.heldOn).toBe("2018-08-31");

    expect(meetings[1]!.title).toBe(
      "第4回 定例会 8月31日　開会・諸般の報告・提案理由の説明"
    );
    expect(meetings[1]!.heldOn).toBe("2018-08-31");

    expect(meetings[2]!.title).toBe("第4回 定例会 9月 3日　議案質疑");
    expect(meetings[2]!.heldOn).toBe("2018-09-03");
  });

  it("複数セッションを正しく分離する", () => {
    const html = `
      <h3>令和7年 第4回 定例会</h3>
      <h4>会期：令和7年5月30日</h4>
      <a href="/files/uploads/2026/02/R7_vol4_teirei_mokuji.pdf">目次[232KB]</a>
      <h3>令和7年 第3回 臨時会</h3>
      <h4>会期：令和7年4月28日</h4>
      <a href="/files/uploads/2025/08/r7_vol3_rinji_report_discuss_vote.pdf">議事録[200KB]</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.sessionName).toBe("令和7年 第4回 定例会");
    expect(meetings[0]!.heldOn).toBe("2025-05-30");
    expect(meetings[1]!.sessionName).toBe("令和7年 第3回 臨時会");
    expect(meetings[1]!.heldOn).toBe("2025-04-28");
  });

  it("会議録 PDF がない場合は空配列を返す", () => {
    const html = `
      <h3>令和7年 第6回 定例会</h3>
      <h4>会期：令和7年11月28日</h4>
      <a href="/files/uploads/2025/11/202512_giann.pdf">議案一覧[100KB]</a>
      <a href="/files/uploads/2025/12/R7_teirei_vol6_question_list.pdf">一般質問通告書[134KB]</a>
      <a href="/files/uploads/2025/12/R7_vol6_teirei_deliberation_result.pdf">審議結果[286KB]</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("実サイトの h2/h3 構造でも正しく抽出する", () => {
    const html = `
      <h2>令和7年 第4回 定例会</h2>
      <h3>会期：令和7年5月30日</h3>
      <ol>
        <li><a href="/files/uploads/2025/05/202506_giann.pdf" target="_blank" rel="noopener">議案一覧[100KB]</a></li>
        <li><a href="/files/uploads/2026/02/R7_vol4_teirei_mokuji.pdf" target="_blank" rel="noopener">目次[232KB]</a></li>
        <li><a href="/files/uploads/2026/02/R7_Vol4_teirei_opening.pdf" target="_blank" rel="noopener">開会・諸般の報告・提案理由の説明[455KB]</a></li>
        <li><a href="/files/uploads/2026/02/R7_vol4_teirei_question_0602.pdf" target="_blank" rel="noopener">議案質疑（6月2日）[543KB]</a></li>
      </ol>
      <h2>令和7年 第3回 臨時会</h2>
      <h3>会期：令和7年4月28日</h3>
      <ol>
        <li><a href="/files/uploads/2025/04/gian_R704.pdf" target="_blank" rel="noopener">議案一覧[84KB]</a></li>
        <li><a href="/files/uploads/2025/08/r7_vol3_rinji_report_discuss_vote.pdf" target="_blank" rel="noopener">議事録[208KB]</a></li>
      </ol>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.sessionName).toBe("令和7年 第4回 定例会");
    expect(meetings[0]!.title).toBe("令和7年 第4回 定例会 目次");
    expect(meetings[0]!.heldOn).toBe("2025-05-30");

    expect(meetings[2]!.title).toBe(
      "令和7年 第4回 定例会 議案質疑（6月2日）"
    );
    expect(meetings[2]!.heldOn).toBe("2025-06-02");

    expect(meetings[3]!.sessionName).toBe("令和7年 第3回 臨時会");
    expect(meetings[3]!.title).toBe("令和7年 第3回 臨時会 議事録");
    expect(meetings[3]!.heldOn).toBe("2025-04-28");
  });

  it("平成30年の臨時会の会議録を抽出する", () => {
    const html = `
      <h3>第5回 臨時会</h3>
      <h4>会期：平成30年11月6日</h4>
      <a href="/files/uploads/2023/06/h3005_rinji_1106.pdf">議案一覧[50KB]</a>
      <a href="/files/uploads/2023/06/eliberation_result_h3011.pdf">審議結果[80KB]</a>
      <a href="/files/uploads/2019/02/h3011_rinji_1106.pdf">会議録[200KB]</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第5回 臨時会 会議録");
    expect(meetings[0]!.heldOn).toBe("2018-11-06");
  });
});
