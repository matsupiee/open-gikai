import { describe, expect, it, vi, afterEach } from "vitest";

// fetch をモックして discussnet-ssp の API 呼び出しをスタブする
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("発言がある場合は MeetingData を返す", async () => {
    // minutes/get_minute API レスポンス
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（伊佐則勝）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（伊佐則勝）　おはようございます。ただいまから令和６年第３回中城村議会定例会を開会いたします。</pre>",
              minute_anchor_id: "",
              minute_type: "○議長",
              minute_type_code: 4,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 45,
        councilName: "令和6年第3回定例会",
        scheduleId: 201,
        scheduleName: "09月10日－01号",
        memberList: "<pre>令和6年9月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_473286",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("muni_473286");
    expect(result!.heldOn).toBe("2024-09-10");
    expect(result!.externalId).toBe("discussnet_ssp_622_45_201");
    expect(result!.sourceUrl).toContain("council_id=45");
    expect(result!.sourceUrl).toContain("schedule_id=201");
    expect(result!.statements).toHaveLength(1);
    expect(result!.statements[0]!.kind).toBe("remark");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
    expect(result!.statements[0]!.speakerName).toBe("伊佐則勝");
  });

  it("定例会の meetingType は plenary になる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（伊佐則勝）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（伊佐則勝）　開会いたします。</pre>",
              minute_anchor_id: "",
              minute_type: "○議長",
              minute_type_code: 4,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 45,
        councilName: "令和6年第3回定例会",
        scheduleId: 201,
        scheduleName: "09月10日－01号",
        memberList: "<pre>令和6年9月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_473286",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時会の meetingType は extraordinary になる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（伊佐則勝）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（伊佐則勝）　開会いたします。</pre>",
              minute_anchor_id: "",
              minute_type: "○議長",
              minute_type_code: 4,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 47,
        councilName: "令和7年5月臨時会（第1回）",
        scheduleId: 301,
        scheduleName: "05月20日－01号",
        memberList: "<pre>令和7年5月20日（火曜日）</pre>",
        viewYear: "2025",
      },
      "muni_473286",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("minutes/get_minute API に正しいパラメータを渡す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（伊佐則勝）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（伊佐則勝）　開会いたします。</pre>",
              minute_anchor_id: "",
              minute_type: "○議長",
              minute_type_code: 4,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 45,
        councilName: "令和6年第3回定例会",
        scheduleId: 201,
        scheduleName: "09月10日－01号",
        memberList: "<pre>令和6年9月10日</pre>",
        viewYear: "2024",
      },
      "muni_473286",
    );

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://ssp.kaigiroku.net/dnp/search/minutes/get_minute");
    const body = new URLSearchParams(options.body as string);
    expect(body.get("tenant_id")).toBe("622");
    expect(body.get("council_id")).toBe("45");
    expect(body.get("schedule_id")).toBe("201");
  });

  it("contentHash は SHA-256 形式の 64 文字 hex 文字列", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（伊佐則勝）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（伊佐則勝）　開会いたします。</pre>",
              minute_anchor_id: "",
              minute_type: "○議長",
              minute_type_code: 4,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 45,
        councilName: "令和6年第3回定例会",
        scheduleId: 201,
        scheduleName: "09月10日－01号",
        memberList: "<pre>令和6年9月10日</pre>",
        viewYear: "2024",
      },
      "muni_473286",
    );

    expect(result!.statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("heldOn を memberList から正しく抽出する（令和形式）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（伊佐則勝）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（伊佐則勝）　開会いたします。</pre>",
              minute_anchor_id: "",
              minute_type: "○議長",
              minute_type_code: 4,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 45,
        councilName: "令和6年第3回定例会",
        scheduleId: 201,
        scheduleName: "09月10日－01号",
        memberList: "<pre>令和6年9月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_473286",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-09-10");
  });

  it("議員の発言者名を正しく抽出する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 2,
              title: "９番（大城常良議員）",
              page_no: 5,
              hit_count: 0,
              body: "<pre>○９番（大城常良議員）　一般質問を行います。</pre>",
              minute_anchor_id: "",
              minute_type: "○議員",
              minute_type_code: 5,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 622,
        tenantSlug: "nakagusuku",
        councilId: 45,
        councilName: "令和6年第3回定例会",
        scheduleId: 201,
        scheduleName: "09月10日－01号",
        memberList: "<pre>令和6年9月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_473286",
    );

    expect(result).not.toBeNull();
    expect(result!.statements).toHaveLength(1);
    expect(result!.statements[0]!.speakerName).toBe("大城常良");
  });
});
