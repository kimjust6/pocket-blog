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
};

