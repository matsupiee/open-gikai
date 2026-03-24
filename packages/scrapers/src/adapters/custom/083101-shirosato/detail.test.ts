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
              title: "議長（関誠一郎君）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（関誠一郎君）　ただいまから令和６年第４回城里町議会定例会を開会いたします。</pre>",
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
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 31,
        councilName: "令和6年12月定例会（第4回）",
        scheduleId: 101,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_083101",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityId).toBe("muni_083101");
    expect(result!.heldOn).toBe("2024-12-10");
    expect(result!.externalId).toBe("discussnet_ssp_621_31_101");
    expect(result!.sourceUrl).toContain("council_id=31");
    expect(result!.sourceUrl).toContain("schedule_id=101");
    expect(result!.statements).toHaveLength(1);
    expect(result!.statements[0]!.kind).toBe("remark");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
    expect(result!.statements[0]!.speakerName).toBe("関誠一郎");
  });

  it("定例会の meetingType は plenary になる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（関誠一郎君）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（関誠一郎君）　開会いたします。</pre>",
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
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 31,
        councilName: "令和6年12月定例会（第4回）",
        scheduleId: 101,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_083101",
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
              title: "議長（関誠一郎君）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（関誠一郎君）　開会いたします。</pre>",
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
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 42,
        councilName: "令和8年1月臨時会（第1回）",
        scheduleId: 201,
        scheduleName: "01月15日－01号",
        memberList: "<pre>令和8年1月15日（水曜日）</pre>",
        viewYear: "2026",
      },
      "muni_083101",
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
              title: "議長（関誠一郎君）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（関誠一郎君）　開会いたします。</pre>",
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
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 31,
        councilName: "令和6年12月定例会（第4回）",
        scheduleId: 101,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日</pre>",
        viewYear: "2024",
      },
      "muni_083101",
    );

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://ssp.kaigiroku.net/dnp/search/minutes/get_minute");
    const body = new URLSearchParams(options.body as string);
    expect(body.get("tenant_id")).toBe("621");
    expect(body.get("council_id")).toBe("31");
    expect(body.get("schedule_id")).toBe("101");
  });

  it("contentHash は SHA-256 形式の 64 文字 hex 文字列", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（関誠一郎君）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（関誠一郎君）　開会いたします。</pre>",
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
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 31,
        councilName: "令和6年12月定例会（第4回）",
        scheduleId: 101,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日</pre>",
        viewYear: "2024",
      },
      "muni_083101",
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
              title: "議長（関誠一郎君）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（関誠一郎君）　開会いたします。</pre>",
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
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 31,
        councilName: "令和6年12月定例会（第4回）",
        scheduleId: 101,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_083101",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-10");
  });

  it("発言がない場合は null を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 621,
        tenantSlug: "shirosato",
        councilId: 31,
        councilName: "令和6年12月定例会（第4回）",
        scheduleId: 101,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日</pre>",
        viewYear: "2024",
      },
      "muni_083101",
    );

    expect(result).toBeNull();
  });
});
