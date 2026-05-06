// Wire format for messages that flow between CloudOS, the content-script
// bridge, and the extension service worker.

export type GetHistoryRequest = {
  type: "cloudos:ext:get-history";
  /** correlation id chosen by the page; echoed back verbatim */
  id: string | number;
  /** result limit (clamped to 1..500 by the service worker) */
  limit?: number;
  /** lower bound on visit time, milliseconds since epoch */
  since?: number;
  /** free-text search; defaults to empty string (everything) */
  text?: string;
};

export type HistoryItem = {
  url: string;
  title: string;
  /** last visit time in milliseconds since epoch, or 0 if unknown */
  lastVisitTime: number;
  visitCount: number;
};

export type GetHistoryResponse = {
  type: "cloudos:ext:get-history:result";
  id: string | number;
  ok: true;
  items: HistoryItem[];
};

export type GetHistoryError = {
  type: "cloudos:ext:get-history:result";
  id: string | number;
  ok: false;
  error: string;
};

export type PingRequest = { type: "cloudos:ext:ping"; id: string | number };
export type PingResponse = {
  type: "cloudos:ext:ping:result";
  id: string | number;
  ok: true;
  version: string;
};

export type ExtensionRequest = GetHistoryRequest | PingRequest;
export type ExtensionResponse = GetHistoryResponse | GetHistoryError | PingResponse;
