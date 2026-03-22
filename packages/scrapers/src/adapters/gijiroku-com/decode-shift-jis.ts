/**
 * Shift_JIS バイト列を UTF-8 文字列にデコードする。
 * gijiroku.com のページは Shift_JIS エンコーディングを使用している。
 */
export function decodeShiftJis(bytes: Uint8Array): string {
  const decoder = new TextDecoder("shift_jis");
  return decoder.decode(bytes);
}
