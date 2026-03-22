import { describe, expect, test, vi, afterEach } from "vitest";
import {
  extractDate,
  stripHtmlTags,
  normalizeFullWidth,
} from "./shared";

vi.mock("./shared", () => {
  // shared の pure 関数は実際のロジックを使い、fetch 系のみモックする
  // vi.mock はファイルトップに巻き上げられるため、ここで直接実装を埋め込む
  function normalizeFullWidth(str: string): string {
    return str.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
  }

  function extractDate(text: string): string | null {
    const normalized = normalizeFullWidth(text);
    const wareki: Record<string, number> = {
      令和: 2018,
      平成: 1988,
      昭和: 1925,
    };
    for (const [era, base] of Object.entries(wareki)) {
      const m = normalized.match(
        new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
      );
      if (m) {
        const year = base + Number(m[1]);
        const month = String(m[2]).padStart(2, "0");
        const day = String(m[3]).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
    const western = normalized.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (western) {
      return `${western[1]}-${String(western[2]).padStart(2, "0")}-${String(western[3]).padStart(2, "0")}`;
    }
    return null;
  }

  function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, "");
  }

  return {
    USER_AGENT: "test",
    normalizeFullWidth,
    extractDate,
    stripHtmlTags,
    detectMeetingType: vi.fn(() => "unknown"),
    fetchWithEncoding: vi.fn(),
    fetchWithEncodingPost: vi.fn(),
    fetchRawBytes: vi.fn(),
    fetchRawBytesPost: vi.fn(),
    decodeShiftJis: vi.fn(),
    percentEncodeBytes: vi.fn(),
    extractTreedepthRawBytes: vi.fn(() => []),
  };
});

import { fetchFromIndexHtml, fetchFromCgi, fetchFromSapphire } from "./list";
import {
  fetchWithEncoding,
  fetchRawBytes,
  decodeShiftJis,
  extractTreedepthRawBytes,
} from "./shared";

describe("fetchFromIndexHtml", () => {
  const mockFetchWithEncoding = (fetchWithEncoding as ReturnType<typeof vi.fn>);
  const mockFetchRawBytes = (fetchRawBytes as ReturnType<typeof vi.fn>);

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("日付つき See.exe リンクがある場合はそのまま返す", async () => {
    mockFetchWithEncoding.mockResolvedValue(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=abc">令和7年3月1日 本会議</a>
      </body></html>`
    );

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    expect(result).toEqual([
      {
        title: "令和7年3月1日 本会議",
        heldOn: "2025-03-01",
        url: "http://www.kensakusystem.jp/testcity/cgi-bin3/See.exe?Code=abc",
      },
    ]);
    // fetchWithEncoding は1回だけ呼ばれる（フォールバックしない）
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
  });

  test("日付なし See.exe リンクのみの場合は fetchFromSapphire にフォールバック", async () => {
    // 1回目: fetchFromIndexHtml が index.html を取得（日付なしリンクのみ）
    mockFetchWithEncoding.mockResolvedValueOnce(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=abc">会議録の閲覧</a>
      </body></html>`
    );
    // fetchFromSapphire は fetchRawBytes を使う
    mockFetchRawBytes.mockResolvedValue(null);

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    // fetchFromIndexHtml が fetchWithEncoding を1回呼び、
    // fetchFromSapphire へのフォールバックで fetchRawBytes が呼ばれることを確認
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
    expect(mockFetchRawBytes).toHaveBeenCalled();
  });

  test("HTML 取得に失敗した場合は null を返す", async () => {
    mockFetchWithEncoding.mockResolvedValue(null);

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    expect(result).toBeNull();
  });
});

describe("fetchFromCgi", () => {
  const mockFetchWithEncoding = (fetchWithEncoding as ReturnType<typeof vi.fn>);
  const mockFetchRawBytes = (fetchRawBytes as ReturnType<typeof vi.fn>);

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("日付つき See.exe リンクがある場合はそのまま返す", async () => {
    mockFetchWithEncoding.mockResolvedValue(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=xyz">令和6年12月15日 予算委員会</a>
      </body></html>`
    );

    const result = await fetchFromCgi(
      "http://www.kensakusystem.jp/testcity/cgi/Search2.exe"
    );

    expect(result).toEqual([
      {
        title: "令和6年12月15日 予算委員会",
        heldOn: "2024-12-15",
        url: "http://www.kensakusystem.jp/testcity/cgi/cgi-bin3/See.exe?Code=xyz",
      },
    ]);
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
  });

  test("日付なしリンクのみの場合は fetchFromSapphire にフォールバック", async () => {
    // 1回目: fetchFromCgi が Search2.exe を取得（日付なし）
    mockFetchWithEncoding.mockResolvedValueOnce(
      `<html><body><p>検索フォーム</p></body></html>`
    );
    // fetchFromSapphire は fetchRawBytes を使う
    mockFetchRawBytes.mockResolvedValue(null);

    const result = await fetchFromCgi(
      "http://www.kensakusystem.jp/testcity/cgi/Search2.exe"
    );

    // fetchFromCgi が fetchWithEncoding を1回呼び、
    // fetchFromSapphire へのフォールバックで fetchRawBytes が呼ばれることを確認
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
    expect(mockFetchRawBytes).toHaveBeenCalled();
  });
});

describe("fetchFromSapphire", () => {
  const mockFetchRawBytes = fetchRawBytes as ReturnType<typeof vi.fn>;
  const mockDecodeShiftJis = decodeShiftJis as ReturnType<typeof vi.fn>;
  const mockExtractTreedepthRawBytes =
    extractTreedepthRawBytes as ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("直接 ResultFrame.exe リンクがある場合はそのまま返す", async () => {
    const html = `<html><body>
      <a href="ResultFrame.exe?Code=abc&amp;fileName=R070301QUES.html">3月1日</a>
    </body></html>`;
    mockFetchRawBytes.mockResolvedValue(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValue(html);
    mockExtractTreedepthRawBytes.mockReturnValue([]);

    const result = await fetchFromSapphire(
      "http://www.kensakusystem.jp/testcity/cgi-bin3/See.exe?Code=abc"
    );

    expect(result).toHaveLength(1);
    expect(result![0]!.heldOn).toBe("2025-03-01");
  });

  test("ページに treedepth がある場合は navigateTreedepths を試みる", async () => {
    const treeHtml = `<html>
      <form name="viewtree" action="See.exe" method="POST">
        <input type="hidden" name="Code" value="abc">
        <input type="hidden" name="treedepth" value="">
      </form>
    </html>`;

    const treedepthBytes = new Uint8Array([0x52, 0x30, 0x37]); // "R07"
    mockFetchRawBytes.mockResolvedValue(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValue(treeHtml);
    // extractTreedepthRawBytes は fetchFromSapphire と navigateTreedepths の両方から呼ばれる
    mockExtractTreedepthRawBytes
      .mockReturnValueOnce([treedepthBytes])  // fetchFromSapphire でのチェック
      .mockReturnValueOnce([treedepthBytes])  // navigateTreedepths での年タブ抽出
      .mockReturnValue([]);                    // POST レスポンスの委員会抽出（以降は空）

    const { fetchRawBytesPost } = await import("./shared");
    const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
    mockFetchRawBytesPost.mockResolvedValue(new Uint8Array([0x42]));

    const { percentEncodeBytes } = await import("./shared");
    (percentEncodeBytes as ReturnType<typeof vi.fn>).mockReturnValue("%52%30%37");

    await fetchFromSapphire(
      "http://www.kensakusystem.jp/testcity/cgi-bin3/See.exe?Code=abc"
    );

    // treedepth がページにあったため、POST による treedepth ナビゲーションが試みられた
    expect(mockFetchRawBytesPost).toHaveBeenCalled();
  });

  test("初回フェッチ失敗時にトップページからフォールバックする", async () => {
    // 1回目: baseUrl の取得が失敗（404 等）
    // 2回目: index.html のフォールバック（See.exe リンクあり）
    // 3回目: See.exe ツリーページの取得
    const indexHtml = `<html><body>
      <a href="cgi-bin3/See.exe?Code=newcode">会議録の閲覧</a>
    </body></html>`;
    const treeHtml = `<html><body>
      <a href="See.exe?Code=newcode">令和7年6月15日 本会議</a>
    </body></html>`;

    mockFetchRawBytes
      .mockResolvedValueOnce(null)                      // baseUrl → 404
      .mockResolvedValueOnce(new Uint8Array([0x41]))    // index.html
      .mockResolvedValueOnce(new Uint8Array([0x42]));   // See.exe ツリーページ

    mockDecodeShiftJis
      .mockReturnValueOnce(indexHtml)
      .mockReturnValueOnce(treeHtml);

    mockExtractTreedepthRawBytes.mockReturnValue([]);

    const result = await fetchFromSapphire(
      "http://www.kensakusystem.jp/testcity/cgi-bin3/Search2.exe?Code=expired"
    );

    expect(result).toHaveLength(1);
    expect(result![0]!.heldOn).toBe("2025-06-15");
    // fetchRawBytes が3回呼ばれる（baseUrl + index.html + See.exe）
    expect(mockFetchRawBytes).toHaveBeenCalledTimes(3);
  });

  test("初回フェッチ成功だが See.exe リンクがない場合もトップページからフォールバックする", async () => {
    const errorHtml = `<html><body>議会名が登録されていません。</body></html>`;
    const indexHtml = `<html><body>
      <a href="cgi-bin3/See.exe?Code=fresh">閲覧</a>
    </body></html>`;
    const treeHtml = `<html><body>
      <a href="See.exe?Code=fresh">令和7年3月10日 定例会</a>
    </body></html>`;

    mockFetchRawBytes
      .mockResolvedValueOnce(new Uint8Array([0x41]))    // baseUrl（エラーページ）
      .mockResolvedValueOnce(new Uint8Array([0x42]))    // index.html
      .mockResolvedValueOnce(new Uint8Array([0x43]));   // See.exe

    mockDecodeShiftJis
      .mockReturnValueOnce(errorHtml)
      .mockReturnValueOnce(indexHtml)
      .mockReturnValueOnce(treeHtml);

    mockExtractTreedepthRawBytes.mockReturnValue([]);

    const result = await fetchFromSapphire(
      "http://www.kensakusystem.jp/testcity/cgi-bin3/Search2.exe?Code=expired&sTarget=2"
    );

    expect(result).toHaveLength(1);
    expect(result![0]!.heldOn).toBe("2025-03-10");
  });

  test("3レベル tree 構造で ResultFrame リンクが見つかる（豊田市パターン）", async () => {
    // 構造:
    //   Level 1（年グループ）: "令和 8年" タブ → POST
    //   Level 2（個別年）: "令和 7年" タブ（ResultFrame なし、新たな treedepth あり）→ POST
    //   Level 3（セッション）: "3月定例会" → POST → ResultFrame.exe リンクあり
    const treeHtml = `<html>
      <form name="viewtree" action="See.exe" method="POST">
        <input type="hidden" name="Code" value="abc">
        <input type="hidden" name="treedepth" value="">
      </form>
    </html>`;

    // Level 2 レスポンス（ResultFrame なし）
    const level2Html = `<html><body>個別年一覧</body></html>`;

    // Level 3 レスポンス（ResultFrame リンクあり）
    const level3Html = `<html><body>
      <a href="ResultFrame.exe?Code=abc&amp;fileName=R070221A&amp;startPos=-1">2月21日</a>
    </body></html>`;

    const yearGroupBytes = new Uint8Array([0x97, 0xdf, 0x38]); // 年グループ
    const yearBytes = new Uint8Array([0x97, 0xdf, 0x37]);      // 個別年
    const sessionBytes = new Uint8Array([0x33, 0x8c, 0x8e]);   // セッション

    mockFetchRawBytes.mockResolvedValue(new Uint8Array([0x41]));

    const { fetchRawBytesPost } = await import("./shared");
    const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
    const { percentEncodeBytes } = await import("./shared");
    const mockPercentEncodeBytes = percentEncodeBytes as ReturnType<typeof vi.fn>;
    mockPercentEncodeBytes.mockReturnValue("%97%df");

    // decodeShiftJis の呼び出し順:
    // 1. fetchFromSapphire: 初回ページ → treeHtml
    // 2. navigateTreedepths: 年グループ POST レスポンス → level2Html
    // 3. navigateTreedepths: committeeBytes の名前取得 → "令和 7"
    // 4. navigateTreedepths: 個別年 POST レスポンス (meetingHtml) → level2Html（ResultFrame なし）
    // 5. navigateTreedepths: subBytes の名前取得 → "3月定例会"
    // 6. navigateTreedepths: セッション POST レスポンス → level3Html（ResultFrame あり）
    mockDecodeShiftJis
      .mockReturnValueOnce(treeHtml)
      .mockReturnValueOnce(level2Html)
      .mockReturnValueOnce("令和 7")
      .mockReturnValueOnce(level2Html)
      .mockReturnValueOnce("3月定例会")
      .mockReturnValueOnce(level3Html);

    // extractTreedepthRawBytes の呼び出し順:
    // 1. fetchFromSapphire: ページの treedepth チェック → [yearGroupBytes]
    // 2. navigateTreedepths: 年タブ抽出 → [yearGroupBytes]
    // 3. 年グループ POST 後: 委員会タブ抽出 → [yearGroupBytes, yearBytes]
    // 4. 個別年 POST 後: サブ treedepth 抽出 → [yearGroupBytes, yearBytes, sessionBytes]
    mockExtractTreedepthRawBytes
      .mockReturnValueOnce([yearGroupBytes])
      .mockReturnValueOnce([yearGroupBytes])
      .mockReturnValueOnce([yearGroupBytes, yearBytes])
      .mockReturnValueOnce([yearGroupBytes, yearBytes, sessionBytes]);

    mockFetchRawBytesPost
      .mockResolvedValueOnce(new Uint8Array([0x42]))  // 年グループ POST
      .mockResolvedValueOnce(new Uint8Array([0x43]))  // 個別年 POST
      .mockResolvedValueOnce(new Uint8Array([0x44])); // セッション POST

    const result = await fetchFromSapphire(
      "http://www.kensakusystem.jp/testcity/cgi-bin3/See.exe?Code=abc"
    );

    // 3回の POST が行われることを確認（年グループ + 個別年 + セッション）
    expect(mockFetchRawBytesPost).toHaveBeenCalledTimes(3);
    // ResultFrame リンクが取得できること
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    expect(result![0]!.heldOn).toBe("2025-02-21");
  });

  test("トップページフォールバックで元URLと同じページはスキップする", async () => {
    const indexHtml = `<html><body>リンクなし</body></html>`;

    mockFetchRawBytes.mockResolvedValue(new Uint8Array([0x41]));
    mockDecodeShiftJis.mockReturnValue(indexHtml);
    mockExtractTreedepthRawBytes.mockReturnValue([]);

    const result = await fetchFromSapphire(
      "https://www.kensakusystem.jp/testcity/index.html"
    );

    expect(result).toBeNull();
    // baseUrl と index.html が同じなのでスキップ → sapphire.html のみ試行
    // baseUrl(1回) + sapphire.html(1回) = 2回
    expect(mockFetchRawBytes).toHaveBeenCalledTimes(2);
  });
});
