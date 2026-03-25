import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○新山勝久議長　ただいまから令和８年大洲市議会第１回臨時会を開会いたします。");
    expect(result.speakerName).toBe("新山勝久");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから令和８年大洲市議会第１回臨時会を開会いたします。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("○18番梅木加津子議員　議案第１号に対する質疑を行います。");
    expect(result.speakerName).toBe("18番梅木加津子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("議案第１号に対する質疑を行います。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○二宮隆久市長　議長");
    expect(result.speakerName).toBe("二宮隆久");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("議長");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("○山田一郎副市長　お答えします。");
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("お答えします。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○田中次郎副議長　暫時休憩します。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩します。");
  });

  it("部長を正しくパースする（複合役職は末尾の役職語でマッチ）", () => {
    const result = parseSpeaker("○鈴木三郎建設部長　ご説明いたします。");
    // 「建設部長」の場合、末尾の「部長」がマッチし、speakerRole は "部長"
    // classifyKind が answer に分類されるので機能的には正しい
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○佐藤四郎教育長　お答えいたします。");
    expect(result.speakerName).toBe("佐藤四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分開議");
  });

  it("本文なし（発言者名のみ）の行", () => {
    const result = parseSpeaker("○二宮隆久市長");
    expect(result.speakerName).toBe("二宮隆久");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("建設部長は answer", () => {
    expect(classifyKind("建設部長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseHeldOn", () => {
  it("令和８年１月13日を正しくパースする", () => {
    const html = "令和８年１月13日（火曜日）";
    expect(parseHeldOn(html)).toBe("2026-01-13");
  });

  it("平成30年3月1日を正しくパースする", () => {
    const html = "平成30年3月1日（木曜日）";
    expect(parseHeldOn(html)).toBe("2018-03-01");
  });

  it("令和元年を正しくパースする", () => {
    const html = "令和元年9月10日";
    expect(parseHeldOn(html)).toBe("2019-09-10");
  });

  it("全角数字を正しくパースする", () => {
    const html = "令和６年６月３日（月曜日）";
    expect(parseHeldOn(html)).toBe("2024-06-03");
  });

  it("日付パターンがない場合は null を返す", () => {
    const html = "会議録第１号";
    expect(parseHeldOn(html)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("発言を正しく抽出する", () => {
    const html = `
      <BODY>
      <P><FONT face="ＭＳ ゴシック">
      ○新山勝久議長　ただいまから令和８年大洲市議会第１回臨時会を開会いたします。<BR>
      　議事日程の第１は、会議録署名議員の指名についてであります。<BR>
      ○18番梅木加津子議員　議案第１号に対する質疑を行います。<BR>
      </FONT></P>
      </BODY>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("新山勝久");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "ただいまから令和８年大洲市議会第１回臨時会を開会いたします。\n議事日程の第１は、会議録署名議員の指名についてであります。",
    );
    expect(statements[1]!.speakerName).toBe("18番梅木加津子");
    expect(statements[1]!.kind).toBe("question");
  });

  it("市長の答弁を answer に分類する", () => {
    const html = `
      <BODY><P><FONT>
      ○新山勝久議長　二宮市長。<BR>
      ○二宮隆久市長　お答えします。<BR>
      </FONT></P></BODY>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("二宮隆久");
    expect(statements[1]!.speakerRole).toBe("市長");
  });

  it("登壇表記をスキップする", () => {
    const html = `
      <BODY><P><FONT>
      〔18番　梅木加津子議員　登壇〕<BR>
      ○18番梅木加津子議員　質問します。<BR>
      </FONT></P></BODY>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("質問します。");
  });

  it("アンカータグ付き発言者を正しく処理する", () => {
    const html = `
      <BODY><P><FONT>
      <A name="202601rinji-1-01">○新山勝久議長</A>　開会します。<BR>
      </FONT></P></BODY>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("新山勝久");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("開会します。");
  });

  it("時刻行をスキップする", () => {
    const html = `
      <BODY><P><FONT>
      午前10時00分開議<BR>
      ○新山勝久議長　開会します。<BR>
      午後1時00分再開<BR>
      ○新山勝久議長　再開します。<BR>
      </FONT></P></BODY>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("開会します。");
    expect(statements[1]!.content).toBe("再開します。");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const html = `
      <BODY><P><FONT>
      ○新山勝久議長　テスト。<BR>
      </FONT></P></BODY>
    `;

    const statements = parseStatements(html);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const html = `
      <BODY><P><FONT>
      ○新山勝久議長　一つ目。<BR>
      ○新山勝久議長　二つ目。<BR>
      </FONT></P></BODY>
    `;

    const statements = parseStatements(html);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("一つ目。".length);
    expect(statements[1]!.startOffset).toBe("一つ目。".length + 1);
  });

  it("○マーカーのある発言がない場合は空配列を返す", () => {
    const html = `<BODY><P><FONT></FONT></P></BODY>`;
    const statements = parseStatements(html);
    expect(statements).toHaveLength(0);
  });
});
