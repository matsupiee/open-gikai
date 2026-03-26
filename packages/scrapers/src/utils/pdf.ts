import {
  extractText,
  getDocumentProxy as _getDocumentProxy,
} from "unpdf";

const PDFJS_VERSION = "5.4.296";
const CMAP_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;

export const getDocumentProxy: typeof _getDocumentProxy = (data, options) =>
  _getDocumentProxy(data, {
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    ...options,
  });

export { extractText };
