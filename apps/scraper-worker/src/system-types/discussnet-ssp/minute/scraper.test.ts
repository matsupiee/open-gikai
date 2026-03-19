import { describe, expect, test } from "vitest";
import {
  classifyKindByCode,
  parseSpeakerFromTitle,
  extractTextFromBody,
  extractDateFromMemberList,
  detectMeetingType,
} from "./scraper";

describe("classifyKindByCode", () => {
  test("code 4 → remark（議長発言）", () => {
    expect(classifyKindByCode(4)).toBe("remark");
  });

  test("code 5 → question", () => {
    expect(classifyKindByCode(5)).toBe("question");
  });

  test("code 6 → answer", () => {
    expect(classifyKindByCode(6)).toBe("answer");
  });

  test("code 2 → null（名簿）", () => {
    expect(classifyKindByCode(2)).toBeNull();
  });

  test("code 3 → null（議題）", () => {
    expect(classifyKindByCode(3)).toBeNull();
  });
});

describe("parseSpeakerFromTitle", () => {
  test("役職（氏名）形式", () => {
    const result = parseSpeakerFromTitle("議長（川越桂路君）");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("川越桂路");
  });

  test("役職（氏名 + 議員サフィックス）形式", () => {
    const result = parseSpeakerFromTitle("市長（田中太郎議員）");
    expect(result.speakerRole).toBe("市長");
    expect(result.speakerName).toBe("田中太郎");
  });

  test("（氏名）のみの形式", () => {
    const result = parseSpeakerFromTitle("（山田花子）");
    expect(result.speakerRole).toBeNull();
    expect(result.speakerName).toBe("山田花子");
  });

  test("マッチしない形式", () => {
    const result = parseSpeakerFromTitle("○議長");
    expect(result.speakerRole).toBeNull();
    expect(result.speakerName).toBeNull();
  });
});

describe("extractTextFromBody", () => {
  test("pre タグを除去してテキストを抽出", () => {
    expect(extractTextFromBody("<pre>本文テキスト</pre>")).toBe("本文テキスト");
  });

  test("複数の HTML タグを除去", () => {
    expect(extractTextFromBody("<pre><b>太字</b>通常</pre>")).toBe(
      "太字通常"
    );
  });

  test("前後の空白をトリム", () => {
    expect(extractTextFromBody("  <pre> テキスト </pre>  ")).toBe("テキスト");
  });
});

describe("extractDateFromMemberList", () => {
  test("和暦（令和）から日付を抽出", () => {
    const memberList = "<pre>令和6年3月15日 開会</pre>";
    expect(extractDateFromMemberList(memberList)).toBe("2024-03-15");
  });

  test("和暦（平成）から日付を抽出", () => {
    const memberList = "<pre>平成31年4月1日</pre>";
    expect(extractDateFromMemberList(memberList)).toBe("2019-04-01");
  });

  test("西暦から日付を抽出", () => {
    const memberList = "<pre>2024年3月15日</pre>";
    expect(extractDateFromMemberList(memberList)).toBe("2024-03-15");
  });

  test("全角数字を正規化して抽出", () => {
    const memberList = "<pre>令和６年３月１５日</pre>";
    expect(extractDateFromMemberList(memberList)).toBe("2024-03-15");
  });

  test("HTML タグを除去して抽出", () => {
    const memberList =
      "<pre><b>令和</b>6年3月15日</pre>";
    expect(extractDateFromMemberList(memberList)).toBe("2024-03-15");
  });

  test("日付がない場合は null", () => {
    expect(extractDateFromMemberList("<pre>日付なし</pre>")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  test("委員会を含む → committee", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  test("臨時会を含む → extraordinary", () => {
    expect(detectMeetingType("令和６年臨時会")).toBe("extraordinary");
  });

  test("その他 → plenary", () => {
    expect(detectMeetingType("令和６年第１回定例会")).toBe("plenary");
  });
});
