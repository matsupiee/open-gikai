import { describe, it, expect } from "vitest";
import {
  parseStatements,
  parseSpeaker,
  classifyKind,
} from "./detail";
import { detectMeetingType } from "./shared";

describe("parseSpeaker", () => {
  it("本会議の議長パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（原田賢一議員）\n　ただいまより本日の会議を開きます。",
    );
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("原田賢一");
    expect(result.content).toBe("ただいまより本日の会議を開きます。");
  });

  it("本会議の議員番号パターンを解析する", () => {
    const result = parseSpeaker(
      "○十一番（青木かの議員）\n　かがやき中央、青木かのです。",
    );
    expect(result.speakerRole).toBe("十一番");
    expect(result.speakerName).toBe("青木かの");
    expect(result.content).toBe("かがやき中央、青木かのです。");
  });

  it("君付けの名前から君を除去する", () => {
    const result = parseSpeaker("○議長（原田賢一君）\n　本文");
    expect(result.speakerName).toBe("原田賢一");
  });

  it("委員会の委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○礒野委員長\n　ただいまより開会いたします。",
    );
    expect(result.speakerRole).toBe("委員長");
    expect(result.speakerName).toBe("礒野");
    expect(result.content).toBe("ただいまより開会いたします。");
  });

  it("委員会の委員パターンを解析する", () => {
    const result = parseSpeaker("○永井委員\n　おはようございます。");
    expect(result.speakerRole).toBe("委員");
    expect(result.speakerName).toBe("永井");
    expect(result.content).toBe("おはようございます。");
  });

  it("委員会の課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○小森広報課長\n　ケーブルテレビの見直しについて",
    );
    expect(result.speakerRole).toBe("課長");
    expect(result.speakerName).toBe("小森広報");
    expect(result.content).toBe("ケーブルテレビの見直しについて");
  });
});

describe("classifyKind", () => {
  it("委員はquestion", () => {
    expect(classifyKind("委員")).toBe("question");
  });

  it("漢数字番号はquestion", () => {
    expect(classifyKind("十一番")).toBe("question");
  });

  it("議長はremark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("委員長はremark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("課長はanswer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("区長はanswer", () => {
    expect(classifyKind("区長")).toBe("answer");
  });

  it("部長はanswer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenary", () => {
    expect(detectMeetingType("令和7年第四回定例会会議録")).toBe("plenary");
  });

  it("委員会はcommittee", () => {
    expect(detectMeetingType("令和7年　決算特別委員会")).toBe("committee");
  });

  it("臨時会はextraordinary", () => {
    expect(detectMeetingType("令和7年第二回臨時会会議録")).toBe(
      "extraordinary",
    );
  });

  it("全員協議会はcommittee", () => {
    expect(detectMeetingType("令和7年　全員協議会")).toBe("committee");
  });
});

describe("parseStatements", () => {
  it("本会議の発言を抽出する", () => {
    const html = `
      <p class="kaigi02">午後二時　開議</p>
      <p class="kaigi02">○議長（原田賢一議員）<br>　ただいまより本日の会議を開きます。</p>
      <p class="kaigi02">○十一番（青木かの議員）<br>　かがやき中央、青木かのです。</p>
      <p class="kaigi02">　二点目の質問です。</p>
      <p class="kaigi02">○区長<br>　お答えいたします。</p>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("原田賢一");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "ただいまより本日の会議を開きます。",
    );

    expect(statements[1]!.speakerRole).toBe("十一番");
    expect(statements[1]!.speakerName).toBe("青木かの");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.content).toContain("かがやき中央");
    expect(statements[1]!.content).toContain("二点目の質問です。");

    expect(statements[2]!.speakerRole).toBe("区長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.content).toBe("お答えいたします。");
  });

  it("委員会の発言を抽出する", () => {
    const html = `
      <p class="kaigi02">（午前10時　開会）</p>
      <p class="kaigi02">○礒野委員長<br>　ただいまより開会いたします。</p>
      <p class="kaigi02">○永井委員<br>　おはようございます。</p>
      <p class="kaigi02">○小森広報課長<br>　お答えいたします。</p>
    `;

    const statements = parseStatements(html);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[0]!.speakerName).toBe("礒野");
    expect(statements[0]!.kind).toBe("remark");

    expect(statements[1]!.speakerRole).toBe("委員");
    expect(statements[1]!.speakerName).toBe("永井");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerRole).toBe("課長");
    expect(statements[2]!.speakerName).toBe("小森広報");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("contentHash が設定される", () => {
    const html = `
      <p class="kaigi02">○議長（原田賢一議員）<br>　テスト</p>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("startOffset と endOffset が正しく計算される", () => {
    const html = `
      <p class="kaigi02">○議長（原田賢一議員）<br>　開会</p>
      <p class="kaigi02">○区長<br>　答弁</p>
    `;

    const statements = parseStatements(html);
    expect(statements).toHaveLength(2);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(2);

    expect(statements[1]!.startOffset).toBe(3);
    expect(statements[1]!.endOffset).toBe(5);
  });
});
