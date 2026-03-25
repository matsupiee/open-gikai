import { describe, expect, it } from "vitest";
import {
  classifyKind,
  resolveRole,
  extractBodyText,
  parseStatements,
  extractHeldOn,
} from "./detail";

describe("resolveRole", () => {
  it("議長を解析する", () => {
    expect(resolveRole("松林議長")).toBe("議長");
  });

  it("町長を解析する", () => {
    expect(resolveRole("町長")).toBe("町長");
  });

  it("副町長を解析する", () => {
    expect(resolveRole("副町長")).toBe("副町長");
  });

  it("番号付き議員を議員に解析する", () => {
    expect(resolveRole("１４番")).toBe("議員");
    expect(resolveRole("3番")).toBe("議員");
  });

  it("課長を解析する", () => {
    expect(resolveRole("総務課長")).toBe("課長");
  });

  it("事務局長を解析する", () => {
    expect(resolveRole("事務局長")).toBe("事務局長");
  });

  it("教育長を解析する", () => {
    expect(resolveRole("教育長")).toBe("教育長");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("建設課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("建設課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("extractBodyText", () => {
  it("「発 言 者 の 要 旨」以降を返す", () => {
    const text = "前文 発 言 者 の 要 旨 事務局長 （佐々木拓仁君） おはようございます。";
    const body = extractBodyText(text);
    expect(body).toBe(" 事務局長 （佐々木拓仁君） おはようございます。");
  });

  it("「発言者の要旨」（スペースなし）以降を返す", () => {
    const text = "前文 発言者の要旨 事務局長 （佐々木拓仁君） おはようございます。";
    const body = extractBodyText(text);
    expect(body).toBe(" 事務局長 （佐々木拓仁君） おはようございます。");
  });

  it("ヘッダーがない場合はテキスト全体を返す", () => {
    const text = "ヘッダーなし 事務局長 （佐々木拓仁君） おはようございます。";
    const body = extractBodyText(text);
    expect(body).toBe(text);
  });
});

describe("parseStatements", () => {
  it("「役職 （名前君）」形式で発言を抽出する", () => {
    const text = `発 言 者 の 要 旨 事務局長 （佐々木拓仁君） おはようございます。議場内の皆様にお願い申し上げます。 松林議長 （田中議長君） ただいまから本日の会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);

    expect(statements[0]!.speakerName).toBe("佐々木拓仁");
    expect(statements[0]!.speakerRole).toBe("事務局長");
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.content).toBe("おはようございます。議場内の皆様にお願い申し上げます。");

    expect(statements[1]!.speakerName).toBe("田中議長");
    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.kind).toBe("remark");
    expect(statements[1]!.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("番号付き議員を question に分類する", () => {
    const text = `発 言 者 の 要 旨 １４番 （西館芳信君） 皆様、おはようございます。一般質問いたします。 松林議長 （松林君） 町長。 町長 （成田隆君） お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("西館芳信");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.kind).toBe("question");

    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.kind).toBe("remark");

    expect(statements[2]!.speakerName).toBe("成田隆");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = `発 言 者 の 要 旨 事務局長 （佐々木拓仁君） おはようございます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `発 言 者 の 要 旨 事務局長 （佐々木君） ただいま。 議長 （田中君） 質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("【...】ページ番号表記を除去する", () => {
    const text = `発 言 者 の 要 旨 議長 （田中君） これが答弁内容です。 【青森県上北郡おいらせ町議会】 －４－ 次の行です。 次 （山田君） 次の発言。`;

    const statements = parseStatements(text);
    expect(statements[0]!.content).toBe("これが答弁内容です。 次の行です。");
  });

  it("発言者が見つからない場合は空配列を返す", () => {
    const text = "発言者の要旨なし、コンテンツだけのテキスト";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("発言内容が空のブロックはスキップする", () => {
    const text = `発 言 者 の 要 旨 議長 （田中君） 議員 （佐藤君） 質問します。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議員");
  });
});

describe("extractHeldOn", () => {
  it("令和の日付を抽出する", () => {
    const text = "令和7年3月5日　第1回おいらせ町議会定例会会議録";
    expect(extractHeldOn(text)).toBe("2025-03-05");
  });

  it("令和元年を正しく変換する", () => {
    const text = "令和元年9月10日　第3回定例会";
    expect(extractHeldOn(text)).toBe("2019-09-10");
  });

  it("平成の日付を抽出する", () => {
    const text = "平成30年12月5日　第4回定例会";
    expect(extractHeldOn(text)).toBe("2018-12-05");
  });

  it("日付がない場合は null を返す", () => {
    const text = "会議録テキスト（日付なし）";
    expect(extractHeldOn(text)).toBeNull();
  });
});
