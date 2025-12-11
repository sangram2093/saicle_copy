import {
  streamJSON,
  streamResponse,
  streamSse,
  toAsyncIterable,
} from "./stream.js";

import patchedFetch from "./node-fetch-patch.js";

import { fetchwithRequestOptions } from "./fetch.js";
import {
  getEnvNoProxyPatterns,
  getProxy,
  getProxyFromEnv,
  getReqOptionsNoProxyPatterns,
  patternMatchesHostname,
  shouldBypassProxy,
} from "./util.js";

export {
  fetchwithRequestOptions,
  getEnvNoProxyPatterns,
  getProxy,
  getProxyFromEnv,
  getReqOptionsNoProxyPatterns,
  patchedFetch,
  patternMatchesHostname,
  shouldBypassProxy,
  streamJSON,
  streamResponse,
  streamSse,
  toAsyncIterable,
};
