import { resolveSignupConfig, runtimeEnvironment } from "./_lib/config.js";
import { jsonResponse } from "./_lib/http.js";

/** @param {Record<string, string | undefined>} env */
export function healthResponse(env) {
  try {
    resolveSignupConfig(env);
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error("signup_config_invalid", {
      error: error instanceof Error ? error.message : "Invalid configuration",
    });
    return jsonResponse({ ok: false }, 503);
  }
}

export default {
  fetch() {
    return healthResponse(runtimeEnvironment());
  },
};
