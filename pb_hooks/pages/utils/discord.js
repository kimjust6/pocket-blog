const {
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
    DISCORD_API_ENDPOINT,
    DISCORD_ID_JUSTIN,
} = require("./constants.js");
const { decodeHttpBody } = require("./http.js");

/**
 * Read a setting value from PocketBase `admin_settings` by key.
 * @param {string} key
 * @returns {string|null}
 */
function getAdminSetting(key) {
    if (!key) {
        return null;
    }
    const record = new Record();
    try {
        $app.recordQuery(POCKET_COLLECTION_ADMIN_SETTINGS)
            .andWhere($dbx.hashExp({ key }))
            .limit(1)
            .one(record);
    } catch (err) {
        $app.logger().error("Error querying admin settings:", "error", err);
        return null;
    }

    return record.get("value") ?? null;
}

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
 * Verify an optional shared secret from env or `admin_settings`.
 * When no secret is configured, returns `{ configured: false, authorized: true }` so existing
 * integrations without a configured secret continue functioning.
 * @param {Object} e PocketBase request event
 * @param {string} envVarName
 * @param {string} adminSettingKey
 * @param {string[]} headerNames
 * @returns {{ configured: boolean, authorized: boolean }}
 */
function verifyConfiguredSecret(e, envVarName, adminSettingKey, headerNames = ["X-Webhook-Secret"]) {
    const envSecret = typeof process !== "undefined" ? process?.env?.[envVarName]?.trim() : "";
    const dbSecret = !envSecret && adminSettingKey ? String(getAdminSetting(adminSettingKey) || "").trim() : "";
    const expected = envSecret || dbSecret;
    if (!expected) {
        return { configured: false, authorized: true };
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

    if (reqInfo?.query?.token) candidates.push(String(reqInfo.query.token));
    if (reqInfo?.query?.secret) candidates.push(String(reqInfo.query.secret));

    const authorized = candidates.some((val) => constantTimeEqual(val.trim(), expected));
    return { configured: true, authorized };
}

/**
 * Retrieve the Discord bot token from env or PocketBase `admin_settings`.
 * @returns {string|null}
 */
function getDiscordBotToken() {
    const envToken = typeof process !== "undefined" ? process?.env?.DISCORD_BOT_TOKEN : "";
    const envTokenTrimmed = envToken ? envToken.trim() : "";
    if (envTokenTrimmed) {
        return envTokenTrimmed;
    }
    const dbToken = getAdminSetting(POCKET_ADMIN_DISCORD_BOT_TOKEN);
    return dbToken ? dbToken.trim() : null;
}

/**
 * Fall back to direct Discord REST API delivery and log outcome.
 * @param {string} message
 * @param {string} userId
 * @param {string} reasonLabel
 */
function fallbackDirectDiscordSend(message, userId, reasonLabel) {
    $app.logger().warn(`${reasonLabel}, falling back to sendDiscordMessage`);
    const result = sendDiscordMessage(message, userId);
    if (!result?.ok) {
        $app.logger().error(
            "Direct Discord send failed:",
            "error",
            result?.error,
            "diagnostics",
            JSON.stringify(result?.diagnostics ?? {})
        );
    } else {
        $app.logger().info("Direct Discord send succeeded");
    }
}

/**
 * Send Discord message using external API proxy with direct fallback.
 * @param {string} message
 * @param {string} userId
 */
function sendDiscordMessage2(message, userId = DISCORD_ID_JUSTIN) {
    const payload = { userId, message };
    try {
        const res = $http.send({
            url: DISCORD_API_ENDPOINT,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const status = res?.status ?? res?.statusCode ?? 0;
        const text = decodeHttpBody(res?.raw ?? res?.body);
        $app.logger().info("sendDiscordMessage2 response:", "status", status, "body", text);

        if (status !== 200) {
            fallbackDirectDiscordSend(message, userId, "sendDiscordMessage2 failed");
        }
    } catch (error) {
        $app.logger().error("Error sending Discord message via proxy:", "error", error);
        fallbackDirectDiscordSend(message, userId, "sendDiscordMessage2 threw");
    }
}

/**
 * Send a direct message via Discord REST v10 using the configured bot token.
 * @param {string} message
 * @param {string} userId
 * @returns {Object}
 */
function sendDiscordMessage(message, userId = DISCORD_ID_JUSTIN) {
    const token = getDiscordBotToken();
    if (!token) {
        return { ok: false, error: "Missing Discord bot token", diagnostics: {} };
    }

    const parseJson = (raw) => {
        const txt = decodeHttpBody(raw);
        if (!txt.trim()) return null;
        try {
            return JSON.parse(txt);
        } catch (err) {
            return { _raw: txt.slice(0, 300), _parseError: err.message };
        }
    };
    const readStatus = (res) => res?.status ?? res?.statusCode ?? res?.code ?? null;
    const mkError = (phase, status, extra) => `${phase} failed: ${extra || "HTTP " + status}`;

    const diagnostics = {};
    try {
        // 1. Create DM channel
        const dmRes = $http.send({
            url: "https://discord.com/api/v10/users/@me/channels",
            method: "POST",
            headers: { Authorization: "Bot " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: userId }),
        });
        const dmStatus = readStatus(dmRes);
        const dmJson = parseJson(dmRes.body);
        diagnostics.dm = {
            status: dmStatus,
            keys: Object.keys(dmRes || {}),
            preview: decodeHttpBody(dmRes.body).slice(0, 120),
            parsedHasId: !!dmJson?.id,
            parseError: dmJson?._parseError,
        };
        const dmOk = dmStatus === 200 || (!dmStatus && dmJson?.id);
        if (!dmOk) {
            const reason =
                dmStatus === 401
                    ? "unauthorized (token)"
                    : dmStatus === 403
                      ? "forbidden (privacy / no mutual server)"
                      : dmStatus === 429
                        ? "rate limited"
                        : "HTTP " + dmStatus;
            return { ok: false, error: mkError("channel create", dmStatus, reason), diagnostics };
        }
        if (!dmJson || dmJson._parseError || !dmJson.id) {
            return { ok: false, error: "channel create parse error", diagnostics };
        }

        // 2. Send message
        const msgRes = $http.send({
            url: `https://discord.com/api/v10/channels/${dmJson.id}/messages`,
            method: "POST",
            headers: { Authorization: "Bot " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ content: message }),
        });
        const msgStatus = readStatus(msgRes);
        const msgJson = parseJson(msgRes.body);
        diagnostics.send = {
            status: msgStatus,
            keys: Object.keys(msgRes || {}),
            preview: decodeHttpBody(msgRes.body).slice(0, 120),
            parsedHasId: !!msgJson?.id,
            parseError: msgJson?._parseError,
        };
        const msgOk = msgStatus === 200 || (!msgStatus && (msgJson?.id || msgJson?.message?.id));
        if (!msgOk) {
            const reason =
                msgStatus === 401
                    ? "unauthorized (scope)"
                    : msgStatus === 403
                      ? "forbidden (channel)"
                      : msgStatus === 429
                        ? "rate limited"
                        : "HTTP " + msgStatus;
            return { ok: false, error: mkError("message send", msgStatus, reason), diagnostics };
        }
        if (!msgJson || msgJson._parseError) {
            return { ok: false, error: "message parse error", diagnostics };
        }

        return { ok: true, channel: dmJson, message: msgJson, diagnostics };
    } catch (err) {
        return { ok: false, error: err?.message || String(err), diagnostics };
    }
}

module.exports = {
    getAdminSetting,
    verifyConfiguredSecret,
    getDiscordBotToken,
    sendDiscordMessage,
    sendDiscordMessage2,
};

