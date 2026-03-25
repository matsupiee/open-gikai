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
              title: "議長（武田茂議員）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（武田茂議員）　ただいまから令和６年第４回岩手町議会定例会を開会いたします。</pre>",
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
        tenantId: 625,
        tenantSlug: "iwate",
        councilId: 101,
        councilName: "令和6年第4回定例会",
        scheduleId: 201,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_033031",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("muni_033031");
    expect(result!.heldOn).toBe("2024-12-10");
    expect(result!.externalId).toBe("discussnet_ssp_625_101_201");
    expect(result!.sourceUrl).toContain("council_id=101");
    expect(result!.sourceUrl).toContain("schedule_id=201");
    expect(result!.statements).toHaveLength(1);
    expect(result!.statements[0]!.kind).toBe("remark");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
    expect(result!.statements[0]!.speakerName).toBe("武田茂");
  });

  it("発言が名簿のみ（minute_type_code=2）の場合は statements が空になる", async () => {
    // 名簿エントリのみ（minute_type_code=2 はスキップ → statements が空配列）
    // heldOn は memberList から取得できるため MeetingData は返る
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "（名簿）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>名簿情報</pre>",
              minute_anchor_id: "",
              minute_type: "名簿",
              minute_type_code: 2,
              speech_type: null,
              minute_link: [],
            },
          ],
        }),
    });

    const result = await fetchMeetingData(
      {
        tenantId: 625,
        tenantSlug: "iwate",
        councilId: 101,
        councilName: "令和6年第4回定例会",
        scheduleId: 201,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日（火曜日）</pre>",
        viewYear: "2024",
      },
      "muni_033031",
    );

    // fetchMinuteData は statements が空でも heldOn が取れれば null を返さない
    expect(result).not.toBeNull();
    expect(result!.statements).toHaveLength(0);
  });

  it("heldOn を memberList から正しく抽出する（令和+数字形式）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tenant_minutes: [
            {
              minute_id: 1,
              title: "議長（武田茂議員）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（武田茂議員）　開会いたします。</pre>",
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
        tenantId: 625,
        tenantSlug: "iwate",
        councilId: 102,
        councilName: "令和6年臨時会",
        scheduleId: 301,
        scheduleName: "06月15日－01号",
        memberList: "<pre>令和6年6月15日（土曜日）</pre>",
        viewYear: "2024",
      },
      "muni_033031",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-06-15");
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
              title: "議長（武田茂議員）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（武田茂議員）　開会いたします。</pre>",
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
        tenantId: 625,
        tenantSlug: "iwate",
        councilId: 101,
        councilName: "令和6年第4回定例会",
        scheduleId: 201,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日</pre>",
        viewYear: "2024",
      },
      "muni_033031",
    );

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://ssp.kaigiroku.net/dnp/search/minutes/get_minute");
    const body = new URLSearchParams(options.body as string);
    expect(body.get("tenant_id")).toBe("625");
    expect(body.get("council_id")).toBe("101");
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
              title: "議長（武田茂議員）",
              page_no: 1,
              hit_count: 0,
              body: "<pre>○議長（武田茂議員）　開会いたします。</pre>",
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
        tenantId: 625,
        tenantSlug: "iwate",
        councilId: 101,
        councilName: "令和6年第4回定例会",
        scheduleId: 201,
        scheduleName: "12月10日－01号",
        memberList: "<pre>令和6年12月10日</pre>",
        viewYear: "2024",
      },
      "muni_033031",
    );

    expect(result!.statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
