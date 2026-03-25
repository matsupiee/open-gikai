export enum SharedSystemAdapterKey {
  DISCUSSNET = "discussnet_ssp",
  DBSEARCH = "dbsearch",
  KENSAKUSYSTEM = "kensakusystem",
  GIJIROKUCOM = "gijiroku_com",
}

export function detectAdapterKey(baseUrl: string, code: string): string {
  // `/tenant/{slug}/` パスパターン: 自ホスト版 DiscussNet
  if (baseUrl.includes("ssp.kaigiroku.net") || /\/tenant\/[^/]+\//.test(baseUrl)) {
    return SharedSystemAdapterKey.DISCUSSNET;
  }

  if (baseUrl.includes("dbsr.jp")) {
    return SharedSystemAdapterKey.DBSEARCH;
  }

  if (baseUrl.includes("kensakusystem.jp") && !baseUrl.includes("-vod/")) {
    return SharedSystemAdapterKey.KENSAKUSYSTEM;
  }

  // `/VOICES/` パスパターン: 自前ホスティングの VOICES インスタンス（茅ヶ崎・春日部等）も同じ voiweb.exe CGI
  // `/g0[78]v_search.asp` パスパターン: voiweb.exe ベースの検索ページ（大田区等、/voices/ パスを持たない自前ホスト）
  if (
    baseUrl.includes("gijiroku.com") ||
    /\/VOICES\//i.test(baseUrl) ||
    /g0[78]v_search\.asp/i.test(baseUrl)
  ) {
    return SharedSystemAdapterKey.GIJIROKUCOM;
  }

  return code;
}
