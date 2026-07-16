import { resolveSignupConfig, runtimeEnvironment } from "./_lib/config.js";
import { jsonResponse } from "./_lib/http.js";

/** @param {Record<string, string | undefined>} env */
export function healthResponse(env) {
  try {
    resolveSignupConfig(env);
    return jsonResponse({ ok: true }, 200);
  } catch {
    return jsonResponse({ ok: false }, 503);
  }
}

export default {
  fetch() {
    return healthResponse(runtimeEnvironment());
  },
};
