import { describe, expect, it, vi, afterEach } from "vitest";

// fetch をモックして discussnet-ssp の API 呼び出しをスタブする
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { fetchMeetingList } from "./list";

describe("fetchMeetingList", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("councils が空の場合は空配列を返す", async () => {
    // councils/index → 空配列
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          councils: [],
        }),
    });

    const records = await fetchMeetingList(2024);

    expect(records).toHaveLength(0);
  });

  it("council と schedule から ListRecord を生成する", async () => {
    // councils/index
    // council name に全角スペースが入っている（実際の API レスポンスと同様）
    // normalizeFullWidth で全角数字を半角に変換するが全角スペースは残る
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          councils: [
            {
              view_years: [
                {
                  view_year: "2024",
                  japanese_year: "令和6年",
                  council_type: [
                    {
                      councils: [
                        { council_id: 101, name: "令和　6年　第4回　定例会" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    // minutes/get_schedule for council_id=101
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          council_schedules: [
            {
              schedule_id: 201,
              name: "12月10日－01号",
              page_no: 1,
              hit_count: 0,
              postit_count: 0,
              member_list: "<pre>令和6年12月10日（火曜日）</pre>",
            },
          ],
        }),
    });

    const records = await fetchMeetingList(2024);

    expect(records).toHaveLength(1);
    const params = records[0]!.detailParams as Record<string, unknown>;
    expect(params["tenantId"]).toBe(625);
    expect(params["tenantSlug"]).toBe("iwate");
    expect(params["councilId"]).toBe(101);
    // normalizeFullWidth: 全角数字→半角、全角スペースはそのまま
    expect(params["councilName"]).toBe("令和　6年　第4回　定例会");
    expect(params["scheduleId"]).toBe(201);
    expect(params["scheduleName"]).toBe("12月10日－01号");
    expect(params["viewYear"]).toBe("2024");
  });

  it("TENANT_ID=625 で councils/index API を呼び出す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ councils: [] }),
    });

    await fetchMeetingList(2024);

    // 呼び出された URL を検証
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://ssp.kaigiroku.net/dnp/search/councils/index");
    expect(options.method).toBe("POST");

    const body = new URLSearchParams(options.body as string);
    expect(body.get("tenant_id")).toBe("625");
  });

  it("複数の council の schedule を正しく展開する", async () => {
    // councils/index: 2件の council
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          councils: [
            {
              view_years: [
                {
                  view_year: "2024",
                  japanese_year: "令和6年",
                  council_type: [
                    {
                      councils: [
                        { council_id: 101, name: "令和　６年　第３回　定例会" },
                        { council_id: 102, name: "令和　６年　第４回　定例会" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    // council_id=101 の schedule: 2件
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          council_schedules: [
            {
              schedule_id: 201,
              name: "09月10日－01号",
              page_no: 1,
              hit_count: 0,
              postit_count: 0,
              member_list: "<pre>令和6年9月10日</pre>",
            },
            {
              schedule_id: 202,
              name: "09月11日－02号",
              page_no: 10,
              hit_count: 0,
              postit_count: 0,
              member_list: "<pre>令和6年9月11日</pre>",
            },
          ],
        }),
    });

    // council_id=102 の schedule: 1件
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          council_schedules: [
            {
              schedule_id: 301,
              name: "12月10日－01号",
              page_no: 1,
              hit_count: 0,
              postit_count: 0,
              member_list: "<pre>令和6年12月10日</pre>",
            },
          ],
        }),
    });

    const records = await fetchMeetingList(2024);

    expect(records).toHaveLength(3);
    expect((records[0]!.detailParams as Record<string, unknown>)["scheduleId"]).toBe(201);
    expect((records[1]!.detailParams as Record<string, unknown>)["scheduleId"]).toBe(202);
    expect((records[2]!.detailParams as Record<string, unknown>)["scheduleId"]).toBe(301);
  });
});
