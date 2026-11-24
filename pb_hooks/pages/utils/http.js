const { getConfigValue } = require("./pocket.js");

/**
 * Compare two strings in constant time to avoid timing leaks on shared secrets.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function constantTimeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const len = Math.max(a.length, b.length);
    let diff = a.length ^ b.length;
    for (let i = 0; i < len; i++) {
        diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
}

/**
 * Verify a shared secret from env or `admin_settings` via request headers.
 * Fails closed when no secret is configured, and never accepts secrets in query strings.
 * @param {Object} e PocketBase request event
 * @param {string} envVarName
 * @param {string} adminSettingKey
 * @param {string[]} headerNames
 * @returns {{ configured: boolean, authorized: boolean }}
 */
function verifyConfiguredSecret(e, envVarName, adminSettingKey, headerNames = ["X-Webhook-Secret"]) {
    const expected = getConfigValue(envVarName, adminSettingKey);
    if (!expected) {
        return { configured: false, authorized: false };
    }

    let reqInfo = null;
    try {
        reqInfo = typeof e?.requestInfo === "function" ? e.requestInfo() : null;
    } catch (_) {}

    const headers = reqInfo?.headers || {};
    const candidates = [];

    headerNames.forEach((name) => {
        const lower = name.toLowerCase();
        if (headers[lower]) candidates.push(String(headers[lower]));
        if (headers[name]) candidates.push(String(headers[name]));
        try {
            const direct = e?.request?.header?.get?.(name);
            if (direct) candidates.push(String(direct));
        } catch (_) {}
    });

    const authHeader = headers.authorization || headers.Authorization || "";
    if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
        candidates.push(authHeader.slice(7).trim());
    }

    const authorized = candidates.some((val) => constantTimeEqual(val.trim(), expected));
    return { configured: true, authorized };
}

/**
 * Decode raw HTTP response bodies (string, Uint8Array, or byte array) to UTF-8 text.
 * @param {string|Uint8Array|number[]|null|undefined} rawBody
 * @returns {string}
 */
function decodeHttpBody(rawBody) {
    if (rawBody == null) {
        return "";
    }

    if (typeof rawBody === "string") {
        return rawBody;
    }

    if (typeof TextDecoder !== "undefined" && rawBody instanceof Uint8Array) {
        try {
            return new TextDecoder().decode(rawBody);
        } catch (_) {
            return String(rawBody);
        }
    }

    if (Array.isArray(rawBody)) {
        try {
            if (typeof TextDecoder !== "undefined") {
                return new TextDecoder().decode(Uint8Array.from(rawBody));
            }
        } catch (_) {
            return rawBody.map((value) => String.fromCharCode(value)).join("");
        }
        return rawBody.map((value) => String.fromCharCode(value)).join("");
    }

    return String(rawBody);
}

/**
 * Parse a PocketBase $http response into JSON when available.
 * @param {Object|null|undefined} response
 * @returns {Object|null}
 */
function getHttpJson(response) {
    if (response?.json && typeof response.json === "object") {
        return response.json;
    }

    const payload = decodeHttpBody(response?.raw ?? response?.body);
    if (!payload.trim()) {
        return null;
    }

    try {
        return JSON.parse(payload);
    } catch (_) {
        return null;
    }
}

module.exports = {
    decodeHttpBody,
    getHttpJson,
    constantTimeEqual,
    verifyConfiguredSecret,
};

