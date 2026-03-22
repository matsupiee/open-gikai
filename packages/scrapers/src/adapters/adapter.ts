/**
 * 2フェーズ (list → detail) スクレイパーの共通インターフェース。
 *
 * 各 system_type はこれを実装して adapter として export する。
 * worker 側の汎用ハンドラーがこのインターフェースを通じてスクレイパーを呼び出すため、
 * 個別の handler ファイルが不要になる。
 */

import type { MeetingData } from "../utils/types";

/**
 * list フェーズの1レコード。
 * detailParams は detail フェーズにキューメッセージ経由でそのまま渡される。
 */
export interface ListRecord {
  detailParams: Record<string, unknown>;
}

/**
 * 2フェーズスクレイパーのアダプターインターフェース。
 */
export interface ScraperAdapter {
  /** adapter 識別子。汎用アダプターは system_types.name、カスタムアダプターは自治体コード */
  readonly name: string;

  /**
   * 一覧取得フェーズ。
   * baseUrl + year から会議一覧を返す。
   * 各レコードの detailParams は detail フェーズに渡すパラメータを含む。
   */
  fetchList(params: {
    baseUrl: string;
    year: number;
  }): Promise<ListRecord[]>;

  /**
   * 詳細取得フェーズ。
   * list で返した detailParams を受け取り、MeetingData を組み立てて返す。
   */
  fetchDetail(params: {
    detailParams: Record<string, unknown>;
    municipalityId: string;
  }): Promise<MeetingData | null>;
}
