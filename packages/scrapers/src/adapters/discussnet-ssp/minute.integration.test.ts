import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  fetchMinuteData,
  extractDateFromMemberList,
  detectMeetingType,
  parseSpeakerFromTitle,
  extractTextFromBody,
} from "./minute";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- extractDateFromMemberList 実データテスト ---

describe("extractDateFromMemberList with real fixtures", () => {
  test("saas: 「令和６年２月２２日」形式（全角数字）の日付を抽出", () => {
    const meta = JSON.parse(fixture("saas", "metadata.json"));
    expect(extractDateFromMemberList(meta.memberList)).toBe("2024-02-22");
  });

  test("self-hosted: 「令和６年11月29日」形式（混在数字）の日付を抽出", () => {
    const meta = JSON.parse(fixture("self-hosted", "metadata.json"));
    expect(extractDateFromMemberList(meta.memberList)).toBe("2024-11-29");
  });

  test("smart: 「令和６年１２月２７日」形式（全角数字）の日付を抽出", () => {
    const meta = JSON.parse(fixture("smart", "metadata.json"));
    expect(extractDateFromMemberList(meta.memberList)).toBe("2024-12-27");
  });
});

// --- parseSpeakerFromTitle 実データテスト ---

describe("parseSpeakerFromTitle with real fixtures", () => {
  test("saas: 「議長（吉田崇仁）」から role と name を抽出", () => {
    const { speakerRole, speakerName } = parseSpeakerFromTitle("議長（吉田崇仁）");
    expect(speakerRole).toBe("議長");
    expect(speakerName).toBe("吉田崇仁");
  });

  test("self-hosted: 「議長（鈴木太郎君）」から君を除去して抽出", () => {
    const { speakerRole, speakerName } = parseSpeakerFromTitle("議長（鈴木太郎君）");
    expect(speakerRole).toBe("議長");
    expect(speakerName).toBe("鈴木太郎");
  });

  test("self-hosted: 「（白井正子君）」から role なしで name を抽出", () => {
    const { speakerRole, speakerName } = parseSpeakerFromTitle("（白井正子君）");
    expect(speakerRole).toBeNull();
    expect(speakerName).toBe("白井正子");
  });

  test("saas: 「総務常任委員長（島昌之）」から role と name を抽出", () => {
    const { speakerRole, speakerName } = parseSpeakerFromTitle("総務常任委員長（島昌之）");
    expect(speakerRole).toBe("総務常任委員長");
    expect(speakerName).toBe("島昌之");
  });
});

// --- extractTextFromBody 実データテスト ---

describe("extractTextFromBody with real fixtures", () => {
  test("saas: <pre>タグを除去してテキストを抽出", () => {
    const text = extractTextFromBody(
      "<pre>○議長（吉田崇仁）　おはようございます。\n　ただいまから定例会を開会いたします。</pre>",
    );
    expect(text).toContain("おはようございます");
    expect(text).not.toContain("<pre>");
    expect(text).not.toContain("</pre>");
  });
});

// --- detectMeetingType 実データテスト ---

describe("detectMeetingType with real fixtures", () => {
  test("saas: 定例会 → plenary", () => {
    expect(detectMeetingType("令和　6年第1回　2月定例会")).toBe("plenary");
  });

  test("self-hosted: 委員会 → committee", () => {
    expect(detectMeetingType("令和　6年　政策経営・総務・財政委員会")).toBe("committee");
  });

  test("smart: 緊急議会 → plenary", () => {
    expect(detectMeetingType("令和　6年　定例会緊急議会（12月）")).toBe("plenary");
  });

  test("saas: 臨時会 → extraordinary", () => {
    expect(detectMeetingType("令和　6年第1回　1月臨時会")).toBe("extraordinary");
  });
});

// --- fetchMinuteData 統合テスト ---

describe("fetchMinuteData integration", () => {
  afterEach(() => vi.restoreAllMocks());

  test("saas: 函館市の議事録データを MeetingData に変換", async () => {
    const minuteJson = JSON.parse(fixture("saas", "minute.json"));
    const meta = JSON.parse(fixture("saas", "metadata.json"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(minuteJson),
      }),
    );

    const result = await fetchMinuteData(
      meta.tenantId,
      meta.tenantSlug,
      meta.councilId,
      meta.councilName,
      {
        scheduleId: meta.scheduleId,
        name: meta.scheduleName,
        memberList: meta.memberList,
      },
      "test-municipality-id",
      { viewYear: meta.viewYear },
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("test-municipality-id");
    expect(result!.heldOn).toBe("2024-02-22");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.statements.length).toBe(20);
    expect(result!.sourceUrl).toContain("ssp.kaigiroku.net");
    expect(result!.sourceUrl).toContain("hakodate");
    expect(result!.externalId).toBe("discussnet_ssp_537_1251_2");

    // 最初の発言の検証
    expect(result!.statements[0]!.kind).toBe("remark");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
    expect(result!.statements[0]!.speakerName).toBe("吉田崇仁");
    expect(result!.statements[0]!.content).toContain("おはようございます");
    expect(result!.statements[0]!.startOffset).toBe(0);

    // offset の連続性検証
    for (let i = 1; i < result!.statements.length; i++) {
      expect(result!.statements[i]!.startOffset).toBe(
        result!.statements[i - 1]!.endOffset + 1,
      );
    }
  });

  test("self-hosted: 横浜市のカスタムホスト議事録データを変換", async () => {
    const minuteJson = JSON.parse(fixture("self-hosted", "minute.json"));
    const meta = JSON.parse(fixture("self-hosted", "metadata.json"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(minuteJson),
      }),
    );

    const result = await fetchMinuteData(
      meta.tenantId,
      meta.tenantSlug,
      meta.councilId,
      meta.councilName,
      {
        scheduleId: meta.scheduleId,
        name: meta.scheduleName,
        memberList: meta.memberList,
      },
      "test-municipality-id",
      {
        apiBase: "http://giji.city.yokohama.lg.jp/dnp/search",
        host: meta.host,
        viewYear: meta.viewYear,
      },
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-11-29");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.statements.length).toBe(50);
    expect(result!.sourceUrl).toContain("giji.city.yokohama.lg.jp");
    expect(result!.sourceUrl).toContain("yokohama");
    expect(result!.externalId).toBe("discussnet_ssp_20_979_2");

    // 最初の発言の検証
    expect(result!.statements[0]!.kind).toBe("remark");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
    expect(result!.statements[0]!.speakerName).toBe("鈴木太郎");

    // offset の連続性検証
    for (let i = 1; i < result!.statements.length; i++) {
      expect(result!.statements[i]!.startOffset).toBe(
        result!.statements[i - 1]!.endOffset + 1,
      );
    }
  });

  test("smart: 河北町（墨田区）の議事録データを変換", async () => {
    const minuteJson = JSON.parse(fixture("smart", "minute.json"));
    const meta = JSON.parse(fixture("smart", "metadata.json"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(minuteJson),
      }),
    );

    const result = await fetchMinuteData(
      meta.tenantId,
      meta.tenantSlug,
      meta.councilId,
      meta.councilName,
      {
        scheduleId: meta.scheduleId,
        name: meta.scheduleName,
        memberList: meta.memberList,
      },
      "test-municipality-id",
      { viewYear: meta.viewYear },
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-27");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.statements.length).toBe(23);
    expect(result!.sourceUrl).toContain("ssp.kaigiroku.net");
    expect(result!.sourceUrl).toContain("kahoku");
    expect(result!.externalId).toBe("discussnet_ssp_396_562_2");

    // 最初の発言の検証
    expect(result!.statements[0]!.kind).toBe("remark");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
    expect(result!.statements[0]!.speakerName).toBe("佐藤篤");

    // offset の連続性検証
    for (let i = 1; i < result!.statements.length; i++) {
      expect(result!.statements[i]!.startOffset).toBe(
        result!.statements[i - 1]!.endOffset + 1,
      );
    }
  });
});
