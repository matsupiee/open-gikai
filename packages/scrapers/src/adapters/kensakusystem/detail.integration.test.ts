import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  parseStatementsFromPlainText,
  extractSpeakerPageInfo,
  fetchMeetingStatements,
  fetchMeetingDataFromSchedule,
} from "./detail";

vi.mock("./shared", () => {
  function detectMeetingType(text: string): string {
    if (text.includes("委員会")) return "committee";
    if (text.includes("臨時会")) return "extraordinary";
    return "plenary";
  }

  return {
    USER_AGENT: "test",
    detectMeetingType,
    fetchWithEncoding: vi.fn(),
    fetchWithEncodingPost: vi.fn(),
    fetchRawBytes: vi.fn(),
    fetchRawBytesPost: vi.fn(),
    decodeShiftJis: vi.fn(),
    percentEncodeBytes: vi.fn(),
    extractTreedepthRawBytes: vi.fn(() => []),
    normalizeFullWidth: vi.fn((s: string) => s),
    extractDate: vi.fn(),
    stripHtmlTags: vi.fn((s: string) => s),
  };
});

import {
  fetchWithEncoding,
  fetchRawBytesPost,
  decodeShiftJis,
} from "./shared";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- parseStatementsFromPlainText 実データテスト ---

describe("parseStatementsFromPlainText with real fixtures", () => {
  test("sapphire: 目黒区の議事録から発言を抽出（名前+役職形式）", () => {
    const text = fixture("sapphire", "statements.txt");
    const stmts = parseStatementsFromPlainText(text);

    // テキスト内の ○ マーカー数（議事日程内の 〇 も含む）
    expect(stmts.length).toBe(31);

    // 最初の発言: ○議事日程 → hasMarker=true, header="議事日程"
    expect(stmts[0]!.speakerName).toBe("議事日程");
    expect(stmts[0]!.speakerRole).toBeNull();
    expect(stmts[0]!.kind).toBe("remark");

    // 2番目: ○おのせ康裕議長 → name=おのせ康裕, role=議長
    expect(stmts[1]!.speakerName).toBe("おのせ康裕");
    expect(stmts[1]!.speakerRole).toBe("議長");
    expect(stmts[1]!.kind).toBe("remark");

    // 区長の発言: ○青木英二区長 → "区長" は ROLE_SUFFIXES にないため speakerRole=null
    const mayorStmt = stmts.find((s) => s.speakerName?.includes("区長"));
    expect(mayorStmt).toBeDefined();

    // ○２０番（鈴木まさし議員） → 末尾が「議員）」で「君/様）」ではないため
    // lastParenMatch が不一致 → speakerName に全体が入る
    const suzukiStmt = stmts.find((s) =>
      s.speakerName?.includes("鈴木まさし")
    );
    expect(suzukiStmt).toBeDefined();

    // offset の連続性を検証
    for (let i = 1; i < stmts.length; i++) {
      expect(stmts[i]!.startOffset).toBe(stmts[i - 1]!.endOffset + 1);
    }

    // contentHash が SHA-256 形式であること
    expect(stmts[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("cgi: 葛飾区の議事録から発言を抽出（括弧+名前+役職形式）", () => {
    const text = fixture("cgi", "statements.txt");
    const stmts = parseStatementsFromPlainText(text);

    expect(stmts.length).toBe(34);

    // 最初: ○議事日程 → hasMarker=true, header="議事日程"
    expect(stmts[0]!.speakerName).toBe("議事日程");
    expect(stmts[0]!.speakerRole).toBeNull();
    expect(stmts[0]!.kind).toBe("remark");

    // 2番目: ○（伊藤よしのり議長） → 外側の括弧で囲まれた形式
    // lastParenMatch で末尾が 君/様 でないため不一致
    // hasMarker=true → speakerName に全体が入る
    expect(stmts[1]!.speakerName).toBe("（伊藤よしのり議長）");
    expect(stmts[1]!.speakerRole).toBeNull();
    expect(stmts[1]!.kind).toBe("remark");

    // 区長の発言: ○（青木克德区長） → 同様に speakerName に全体が入る
    const mayorStmt = stmts.find((s) => s.speakerName?.includes("区長"));
    expect(mayorStmt).toBeDefined();

    // ○２２番（筒井たかひさ議員） → 「議員）」のため lastParenMatch 不一致
    const tsutsui = stmts.find((s) => s.speakerName?.includes("筒井"));
    expect(tsutsui).toBeDefined();

    // offset の連続性を検証
    for (let i = 1; i < stmts.length; i++) {
      expect(stmts[i]!.startOffset).toBe(stmts[i - 1]!.endOffset + 1);
    }
  });

  test("index-html: 弘前市の議事録から発言を抽出（役職（名前議員）形式）", () => {
    const text = fixture("index-html", "statements.txt");
    const stmts = parseStatementsFromPlainText(text);

    expect(stmts.length).toBe(13);

    // 最初: ○議事日程 → hasMarker=true, header="議事日程"
    expect(stmts[0]!.speakerName).toBe("議事日程");
    expect(stmts[0]!.speakerRole).toBeNull();
    expect(stmts[0]!.kind).toBe("remark");

    // 2番目: ○議長（清野一榮議員） → 末尾が「議員）」で「君/様）」ではないため
    // lastParenMatch 不一致 → speakerName に全体が入る
    expect(stmts[1]!.speakerName).toBe("議長（清野一榮議員）");
    expect(stmts[1]!.speakerRole).toBeNull();
    expect(stmts[1]!.kind).toBe("remark");

    // 市長の発言: ○市長（櫻田　宏） → 名前内の全角スペースで header が分割される
    // header = "市長（櫻田" → "市長" を含むが ROLE_SUFFIXES 不一致
    const mayorStmt = stmts.find((s) => s.speakerName?.includes("市長"));
    expect(mayorStmt).toBeDefined();

    // offset の連続性を検証
    for (let i = 1; i < stmts.length; i++) {
      expect(stmts[i]!.startOffset).toBe(stmts[i - 1]!.endOffset + 1);
    }
  });
});

// --- extractSpeakerPageInfo 実データテスト ---

describe("extractSpeakerPageInfo with real fixtures", () => {
  test("sapphire: 目黒区の speakers.html から download フォーム情報を抽出", () => {
    const html = fixture("sapphire", "speakers.html");
    const info = extractSpeakerPageInfo(html);

    expect(info.actionUrl).toBe("/meguro/cgi-bin3/GetPerson.exe");
    expect(info.code).toBe("hxcvax8v0tgrybompl");
    expect(info.fileName).toBe("R070217A");
    expect(info.downloadPositions.length).toBe(26);
    expect(info.downloadPositions[0]).toBe("4");
  });

  test("cgi: 葛飾区の speakers.html から download フォーム情報を抽出", () => {
    const html = fixture("cgi", "speakers.html");
    const info = extractSpeakerPageInfo(html);

    expect(info.actionUrl).toBe("/katsushika/cgi-bin3/GetPerson.exe");
    expect(info.code).toBe("n9goyxzrwrkcenlj8f");
    expect(info.fileName).toBe("R070214A");
    expect(info.downloadPositions.length).toBe(34);
    expect(info.downloadPositions[0]).toBe("226");
  });

  test("index-html: 弘前市の speakers.html から download フォーム情報を抽出", () => {
    const html = fixture("index-html", "speakers.html");
    const info = extractSpeakerPageInfo(html);

    expect(info.actionUrl).toBe("/hirosaki/cgi-bin3/GetPerson.exe");
    expect(info.code).toBe("jdos47sfsd973gseoq");
    expect(info.fileName).toBe("R050217A");
    expect(info.downloadPositions.length).toBe(13);
    expect(info.downloadPositions[0]).toBe("12");
  });
});

// --- fetchMeetingStatements 統合テスト ---

describe("fetchMeetingStatements integration", () => {
  const mockFetchWithEncoding = fetchWithEncoding as ReturnType<typeof vi.fn>;
  const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
  const mockDecodeShiftJis = decodeShiftJis as ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("sapphire: 目黒区の frameset → speakers → statements フローで発言を取得", async () => {
    const framesetHtml = fixture("sapphire", "frameset.html");
    const speakersHtml = fixture("sapphire", "speakers.html");
    const statementsText = fixture("sapphire", "statements.txt");

    // 1st call: GET frameset (ResultFrame.exe)
    mockFetchWithEncoding.mockResolvedValueOnce(framesetHtml);
    // 2nd call: GET speakers (r_Speakers.exe)
    mockFetchWithEncoding.mockResolvedValueOnce(speakersHtml);
    // 3rd call: POST GetPerson.exe → raw bytes → decode
    mockFetchRawBytesPost.mockResolvedValueOnce(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValueOnce(statementsText);

    const result = await fetchMeetingStatements(
      "http://www.kensakusystem.jp/meguro/cgi-bin3/ResultFrame.exe?Code=hxcvax8v0tgrybompl&fileName=R070217A&startPos=0"
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBe(31);
    expect(result![1]!.speakerName).toBe("おのせ康裕");
    expect(result![1]!.speakerRole).toBe("議長");

    // fetchWithEncoding が frameset と speakers で 2 回呼ばれること
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(2);
    // GetPerson.exe への POST が 1 回呼ばれること
    expect(mockFetchRawBytesPost).toHaveBeenCalledTimes(1);
  });

  test("cgi: 葛飾区の frameset → speakers → statements フローで発言を取得", async () => {
    const framesetHtml = fixture("cgi", "frameset.html");
    const speakersHtml = fixture("cgi", "speakers.html");
    const statementsText = fixture("cgi", "statements.txt");

    mockFetchWithEncoding.mockResolvedValueOnce(framesetHtml);
    mockFetchWithEncoding.mockResolvedValueOnce(speakersHtml);
    mockFetchRawBytesPost.mockResolvedValueOnce(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValueOnce(statementsText);

    const result = await fetchMeetingStatements(
      "http://www.kensakusystem.jp/katsushika/cgi-bin3/ResultFrame.exe?Code=n9goyxzrwrkcenlj8f&fileName=R070214A&startPos=0"
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBe(34);
    expect(result![1]!.speakerName).toBe("（伊藤よしのり議長）");
  });

  test("index-html: 弘前市の frameset → speakers → statements フローで発言を取得", async () => {
    const framesetHtml = fixture("index-html", "frameset.html");
    const speakersHtml = fixture("index-html", "speakers.html");
    const statementsText = fixture("index-html", "statements.txt");

    mockFetchWithEncoding.mockResolvedValueOnce(framesetHtml);
    mockFetchWithEncoding.mockResolvedValueOnce(speakersHtml);
    mockFetchRawBytesPost.mockResolvedValueOnce(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValueOnce(statementsText);

    const result = await fetchMeetingStatements(
      "http://www.kensakusystem.jp/hirosaki/cgi-bin3/ResultFrame.exe?Code=jdos47sfsd973gseoq&fileName=R050217A&startPos=0"
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBe(13);
    // ○議長（清野一榮議員） → 「議員）」で終わるため lastParenMatch 不一致
    expect(result![1]!.speakerName).toBe("議長（清野一榮議員）");
    expect(result![1]!.speakerRole).toBeNull();
  });
});

// --- fetchMeetingDataFromSchedule 統合テスト ---

describe("fetchMeetingDataFromSchedule integration", () => {
  const mockFetchWithEncoding = fetchWithEncoding as ReturnType<typeof vi.fn>;
  const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
  const mockDecodeShiftJis = decodeShiftJis as ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("sapphire: 目黒区の定例会から MeetingData を取得", async () => {
    const framesetHtml = fixture("sapphire", "frameset.html");
    const speakersHtml = fixture("sapphire", "speakers.html");
    const statementsText = fixture("sapphire", "statements.txt");

    mockFetchWithEncoding
      .mockResolvedValueOnce(framesetHtml)
      .mockResolvedValueOnce(speakersHtml);
    mockFetchRawBytesPost.mockResolvedValueOnce(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValueOnce(statementsText);

    const result = await fetchMeetingDataFromSchedule(
      {
        title: "令和 7年第1回定例会（第1日 2月17日）",
        heldOn: "2025-02-17",
        url: "http://www.kensakusystem.jp/meguro/cgi-bin3/ResultFrame.exe?Code=hxcvax8v0tgrybompl&fileName=R070217A&startPos=0",
      },
      "test-municipality-id",
      "meguro"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和 7年第1回定例会（第1日 2月17日）");
    expect(result!.heldOn).toBe("2025-02-17");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("kensakusystem_meguro_R070217A");
    expect(result!.municipalityId).toBe("test-municipality-id");
    expect(result!.statements.length).toBe(31);
  });

  test("cgi: 葛飾区の定例会から MeetingData を取得", async () => {
    const framesetHtml = fixture("cgi", "frameset.html");
    const speakersHtml = fixture("cgi", "speakers.html");
    const statementsText = fixture("cgi", "statements.txt");

    mockFetchWithEncoding
      .mockResolvedValueOnce(framesetHtml)
      .mockResolvedValueOnce(speakersHtml);
    mockFetchRawBytesPost.mockResolvedValueOnce(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValueOnce(statementsText);

    const result = await fetchMeetingDataFromSchedule(
      {
        title: "令和 7年第1回定例会（第1日 2月14日）",
        heldOn: "2025-02-14",
        url: "http://www.kensakusystem.jp/katsushika/cgi-bin3/ResultFrame.exe?Code=n9goyxzrwrkcenlj8f&fileName=R070214A&startPos=0",
      },
      "test-municipality-id",
      "katsushika"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和 7年第1回定例会（第1日 2月14日）");
    expect(result!.heldOn).toBe("2025-02-14");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("kensakusystem_katsushika_R070214A");
    expect(result!.municipalityId).toBe("test-municipality-id");
    expect(result!.statements.length).toBe(34);
  });

  test("index-html: 弘前市の定例会から MeetingData を取得", async () => {
    const framesetHtml = fixture("index-html", "frameset.html");
    const speakersHtml = fixture("index-html", "speakers.html");
    const statementsText = fixture("index-html", "statements.txt");

    mockFetchWithEncoding
      .mockResolvedValueOnce(framesetHtml)
      .mockResolvedValueOnce(speakersHtml);
    mockFetchRawBytesPost.mockResolvedValueOnce(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValueOnce(statementsText);

    const result = await fetchMeetingDataFromSchedule(
      {
        title: "令和 5年第1回定例会（第1号 2月17日）",
        heldOn: "2023-02-17",
        url: "http://www.kensakusystem.jp/hirosaki/cgi-bin3/ResultFrame.exe?Code=jdos47sfsd973gseoq&fileName=R050217A&startPos=0",
      },
      "test-municipality-id",
      "hirosaki"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和 5年第1回定例会（第1号 2月17日）");
    expect(result!.heldOn).toBe("2023-02-17");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("kensakusystem_hirosaki_R050217A");
    expect(result!.municipalityId).toBe("test-municipality-id");
    expect(result!.statements.length).toBe(13);
  });
});
