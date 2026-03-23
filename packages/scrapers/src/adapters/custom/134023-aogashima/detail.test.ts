import { describe, expect, it } from "vitest";
import { parseSessions, parseBills, billsToStatements } from "./detail";

describe("parseSessions", () => {
  it("議決一覧セッションを正しく抽出する（半角数字・スペースなし）", () => {
    const text = `
広報あおがしま No.414
令和6年青ヶ島村議会第1回定例会議決一覧
3月7日
議案第 1 号 原案可決 青ヶ島村長等の給料等に関する条例の一部を改正する条例について
議案第 2 号 原案可決 青ヶ島村職員の給与に関する条例の一部を改正する条例について
議案第 3 号 同意 青ヶ島村監査員の選任の同意について
`;

    const sessions = parseSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("令和6年青ヶ島村議会第1回定例会");
    expect(sessions[0]!.heldOn).toBe("2024-03-07");
    expect(sessions[0]!.bills).toHaveLength(3);
    expect(sessions[0]!.bills[0]!.number).toBe(1);
    expect(sessions[0]!.bills[0]!.result).toBe("原案可決");
    expect(sessions[0]!.bills[0]!.title).toBe(
      "青ヶ島村長等の給料等に関する条例の一部を改正する条例について"
    );
    expect(sessions[0]!.bills[2]!.result).toBe("同意");
  });

  it("PDF テキストの実際のフォーマット（スペース・全角数字混在）を正しくパースする", () => {
    const text =
      "令和 6 年青ヶ島村議会第１回定例会議決一覧 ３月７日 議案第 1 号 原案可決 条例Aについて 議案第 2 号 同意 選任の同意について";

    const sessions = parseSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("令和6年青ヶ島村議会第1回定例会");
    expect(sessions[0]!.heldOn).toBe("2024-03-07");
    expect(sessions[0]!.bills).toHaveLength(2);
    expect(sessions[0]!.bills[0]!.number).toBe(1);
    expect(sessions[0]!.bills[0]!.result).toBe("原案可決");
    expect(sessions[0]!.bills[0]!.title).toBe("条例Aについて");
    expect(sessions[0]!.bills[1]!.result).toBe("同意");
  });

  it("複数日程の議決一覧を正しく抽出する", () => {
    const text = `
令和6年青ヶ島村議会第1回定例会議決一覧
3月7日
議案第 1 号 原案可決 条例Aについて
3月28日
議案第 2 号 原案可決 条例Bについて
議案第 3 号 同意 選任の同意について
`;

    const sessions = parseSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBe("2024-03-07");
    expect(sessions[0]!.bills).toHaveLength(3);
  });

  it("教育委員会の議決一覧は除外する", () => {
    const text = `
令和6年青ヶ島村議会第4回定例会議決一覧
12月5日
議案第 1 号 原案可決 条例Aについて

令和 6 年度 青ヶ島村教育委員会第9回定例会 令和6年12月26日（木）
議案第16号 可決 「青ヶ島村出身高校生の奨学金支給規則」の一部改正について
`;

    const sessions = parseSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("令和6年青ヶ島村議会第4回定例会");
    expect(sessions[0]!.bills).toHaveLength(1);
  });

  it("平成の議決一覧を正しく処理する", () => {
    const text = `
平成30年青ヶ島村議会第2回定例会議決一覧
6月15日
議案第 1 号 原案可決 予算案について
`;

    const sessions = parseSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("平成30年青ヶ島村議会第2回定例会");
    expect(sessions[0]!.heldOn).toBe("2018-06-15");
  });

  it("議決一覧がない場合は空配列を返す", () => {
    const text = `
広報あおがしま No.413
お知らせ
村長公務 令和6年12月
12月 5日（木）令和6年第4回青ヶ島村議会 定例会
`;

    const sessions = parseSessions(text);
    expect(sessions).toHaveLength(0);
  });

  it("議第第（タイプミス）を含む議案も抽出する", () => {
    const text = `
令和6年青ヶ島村議会第1回定例会議決一覧
3月7日
議案第 14 号 原案可決 条例Aについて
議第第 15 号 原案可決 条例Bについて
`;

    const sessions = parseSessions(text);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.bills).toHaveLength(2);
    expect(sessions[0]!.bills[0]!.number).toBe(14);
    expect(sessions[0]!.bills[1]!.number).toBe(15);
  });
});

describe("parseBills", () => {
  it("議案行を正しく抽出する", () => {
    const sectionText = `
3月7日
議案第 1 号 原案可決 青ヶ島村長等の給料等に関する条例の一部を改正する条例について
議案第 2 号 同意 青ヶ島村監査員の選任の同意について
`;

    const bills = parseBills(sectionText);

    expect(bills).toHaveLength(2);
    expect(bills[0]!.number).toBe(1);
    expect(bills[0]!.result).toBe("原案可決");
    expect(bills[0]!.title).toBe(
      "青ヶ島村長等の給料等に関する条例の一部を改正する条例について"
    );
    expect(bills[1]!.number).toBe(2);
    expect(bills[1]!.result).toBe("同意");
  });

  it("議案がない場合は空配列を返す", () => {
    const sectionText = `3月7日 本日の議事は以上です。`;

    const bills = parseBills(sectionText);
    expect(bills).toHaveLength(0);
  });

  it("否決の議案も抽出する", () => {
    const sectionText = `
議案第 5 号 否決 ○○に関する条例案について
`;

    const bills = parseBills(sectionText);

    expect(bills).toHaveLength(1);
    expect(bills[0]!.result).toBe("否決");
  });

  it("全角数字の議案番号もパースする", () => {
    const sectionText = `
議案第 １０ 号 原案可決 予算案について
`;

    const bills = parseBills(sectionText);

    expect(bills).toHaveLength(1);
    expect(bills[0]!.number).toBe(10);
  });
});

describe("billsToStatements", () => {
  it("議案を ParsedStatement に変換する", () => {
    const statements = billsToStatements([
      { number: 1, result: "原案可決", title: "条例Aについて" },
      { number: 2, result: "同意", title: "選任の同意について" },
    ]);

    expect(statements).toHaveLength(2);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.content).toBe("議案第1号 原案可決 条例Aについて");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("議案第1号 原案可決 条例Aについて".length);

    expect(statements[1]!.content).toBe("議案第2号 同意 選任の同意について");
    expect(statements[1]!.startOffset).toBe(
      "議案第1号 原案可決 条例Aについて".length + 1
    );
  });

  it("空の議案リストは空の配列を返す", () => {
    const statements = billsToStatements([]);
    expect(statements).toHaveLength(0);
  });
});
