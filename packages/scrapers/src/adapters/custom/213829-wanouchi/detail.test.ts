import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseDateFromPdf,
  parseTitleFromPdf,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（上野賢二君）　ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("上野賢二");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（荒川 浩君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("荒川浩");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（朝倉和仁君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("朝倉和仁");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（長屋英人君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("長屋英人");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("全角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○９番（田中政治君）　質問いたします。"
    );
    expect(result.speakerName).toBe("田中政治");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○5番（浅野 進君）　質問いたします。"
    );
    expect(result.speakerName).toBe("浅野進");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○企画財政商工課長（菱田靖雄君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("菱田靖雄");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○文教厚生常任委員長（林 日出雄君）　委員会の報告を行います。"
    );
    expect(result.speakerName).toBe("林日出雄");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員会の報告を行います。");
  });

  it("特別委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○人口減少対策特別委員長（大橋慶裕君）　特別委員会の報告を行います。"
    );
    expect(result.speakerName).toBe("大橋慶裕");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("特別委員会の報告を行います。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○副町長（荒川　浩君）　ご説明します。"
    );
    expect(result.speakerName).toBe("荒川浩");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("室長は answer", () => {
    expect(classifyKind("室長")).toBe("answer");
  });

  it("主幹は answer", () => {
    expect(classifyKind("主幹")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseDateFromPdf", () => {
  it("令和スペース区切りの日付をパースする（開会付き）", () => {
    expect(parseDateFromPdf("令和 ７ 年 ３ 月 ３ 日  開会")).toBe(
      "2025-03-03"
    );
  });

  it("スペースなしの令和日付をパースする", () => {
    expect(parseDateFromPdf("令和7年3月3日")).toBe("2025-03-03");
  });

  it("令和8年1月の日付をパースする", () => {
    expect(parseDateFromPdf("令和 ８ 年 １ 月 20 日  開会")).toBe(
      "2026-01-20"
    );
  });

  it("令和元年に対応する", () => {
    expect(parseDateFromPdf("令和元年5月1日")).toBe("2019-05-01");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateFromPdf("平成31年4月30日")).toBe("2019-04-30");
  });

  it("開会日を閉会日より優先して取得する", () => {
    const text = `令和 ７ 年 ３ 月 ３ 日    開会
令和 ７ 年 ３ 月 14 日    閉会`;
    expect(parseDateFromPdf(text)).toBe("2025-03-03");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromPdf("目次")).toBeNull();
  });
});

describe("parseTitleFromPdf", () => {
  it("定例会タイトルを抽出する", () => {
    expect(
      parseTitleFromPdf("令和７年\n\n第１回定例輪之内町議会会議録")
    ).toBe("令和7年第1回定例輪之内町議会");
  });

  it("臨時会タイトルを抽出する", () => {
    expect(
      parseTitleFromPdf("令和７年\n\n第２回臨時輪之内町議会会議録")
    ).toBe("令和7年第2回臨時輪之内町議会");
  });

  it("スペースが挿入されたタイトルにも対応する", () => {
    expect(
      parseTitleFromPdf("令和 ７ 年 第 １ 回 定例 輪之内町議会 会議録")
    ).toBe("令和7年第1回定例輪之内町議会");
  });

  it("タイトルがない場合は null を返す", () => {
    expect(parseTitleFromPdf("出席議員一覧")).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（上野賢二君）　ただいまから本日の会議を開きます。
○９番（田中政治君）　質問があります。
○町長（朝倉和仁君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("上野賢二");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中政治");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("朝倉和仁");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（上野賢二君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（上野賢二君）　ただいま。
○９番（田中政治君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("動作・声の表記（（「異議なし」の声あり）等）はスキップする", () => {
    const text = `○議長（上野賢二君）　採決します。
（「異議なし」の声あり）
○議長（上野賢二君）　可決されました。`;

    const statements = parseStatements(text);
    // 動作表記はスキップされるが、議長の2発言は取得
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements.every((s) => s.speakerRole === "議長")).toBe(true);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言を answer に分類する", () => {
    const text =
      "○企画財政商工課長（菱田靖雄君）　ご説明いたします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[0]!.speakerName).toBe("菱田靖雄");
  });

  it("委員長の発言を remark に分類する", () => {
    const text =
      "○文教厚生常任委員長（林 日出雄君）　委員会の報告を行います。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("委員長");
  });
});
