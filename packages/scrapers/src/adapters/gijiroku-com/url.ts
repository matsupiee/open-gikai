/**
 * gijiroku.com URL ユーティリティ
 *
 * baseUrl から voiweb.exe CGI のベースパスを抽出する。
 *
 * gijiroku.com の議事録システムは、以下のようなパス構造を持つ:
 *   - /voices/cgi/voiweb.exe         (最も一般的)
 *   - /gikai/voices/cgi/voiweb.exe   (蕨市等)
 *   - /kawasaki_council/cgi/voiweb.exe (川崎市)
 *   - /niigata/cgi/voiweb.exe         (新潟市)
 *
 * baseUrl の例:
 *   http://sapporo.gijiroku.com/voices/g07v_search.asp
 *   https://www13.gijiroku.com/kawasaki_council/g07v_search.asp?Sflg=2
 *   http://www06.gijiroku.com/niigata/
 *   http://warabi.gijiroku.com/gikai/voices/g08v_search.asp
 */

/**
 * baseUrl から voiweb.exe CGI のベースパスを抽出する。
 *
 * 1. /voices/ を含む場合は /voices まで（従来の動作）
 * 2. それ以外は、ファイル名部分を除いたディレクトリパス
 *
 * @returns origin と basePath（例: ["https://sapporo.gijiroku.com", "/voices"]）、
 *          失敗時は null
 */
export function extractBaseInfo(baseUrl: string): {
  origin: string;
  basePath: string;
} | null {
  try {
    const url = new URL(baseUrl);
    // gijiroku.com SaaS は HTTPS を使用、自前ホストは元のプロトコルを保持
    if (url.hostname.endsWith("gijiroku.com")) {
      url.protocol = "https:";
    }

    // 1. /voices/ を含む場合は /voices まで（従来の動作）
    const voicesMatch = url.pathname.match(/^(.*\/voices)\//i);
    if (voicesMatch?.[1]) {
      return { origin: url.origin, basePath: voicesMatch[1] };
    }

    // 2. ファイル名を除去してディレクトリパスを取得
    //    例: /kawasaki_council/g07v_search.asp → /kawasaki_council
    //    例: /niigata/ → /niigata
    const pathname = url.pathname.replace(/\/[^/]*\.[^/]*$/, ""); // ファイル名除去
    const basePath = pathname.replace(/\/+$/, ""); // 末尾スラッシュ除去

    if (!basePath) return null;

    return { origin: url.origin, basePath };
  } catch {
    return null;
  }
}
