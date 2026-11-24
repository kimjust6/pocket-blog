const {
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
    DISCORD_API_ENDPOINT,
    DISCORD_ID_JUSTIN,
} = require("./constants.js");
const { decodeHttpBody, verifyConfiguredSecret } = require("./http.js");
const { getAdminSetting, getConfigValue } = require("./pocket.js");

/**
 * Retrieve the Discord bot token from env or PocketBase `admin_settings`.
 * @returns {string|null}
 */
function getDiscordBotToken() {
    const token = getConfigValue("DISCORD_BOT_TOKEN", POCKET_ADMIN_DISCORD_BOT_TOKEN);
    return token || null;
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

function parseDiscordJson(raw) {
    const txt = decodeHttpBody(raw);
    if (!txt.trim()) return null;
    try {
        return JSON.parse(txt);
    } catch (err) {
        return { _raw: txt.slice(0, 300), _parseError: err.message };
    }
}

function discordRequest(url, token, body, phase, errorReasons, hasValidPayload) {
    const res = $http.send({
        url,
        method: "POST",
        headers: { Authorization: "Bot " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const status = res?.status ?? res?.statusCode ?? res?.code ?? null;
    const json = parseDiscordJson(res?.body);
    const diag = {
        status,
        keys: Object.keys(res || {}),
        preview: decodeHttpBody(res?.body).slice(0, 120),
        parsedHasId: !!json?.id,
        parseError: json?._parseError,
    };
    const ok = status === 200 || (!status && hasValidPayload(json));
    if (!ok) {
        const reason = errorReasons[status] || `HTTP ${status}`;
        return { ok: false, error: `${phase} failed: ${reason}`, diag, json };
    }
    if (!json || json._parseError) {
        return { ok: false, error: `${phase} parse error`, diag, json };
    }
    return { ok: true, diag, json };
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

    const diagnostics = {};
    try {
        // 1. Create DM channel
        const dmResult = discordRequest(
            "https://discord.com/api/v10/users/@me/channels",
            token,
            { recipient_id: userId },
            "channel create",
            {
                401: "unauthorized (token)",
                403: "forbidden (privacy / no mutual server)",
                429: "rate limited",
            },
            (json) => !!json?.id
        );
        diagnostics.dm = dmResult.diag;
        if (!dmResult.ok || !dmResult.json?.id) {
            return { ok: false, error: dmResult.error || "channel create parse error", diagnostics };
        }

        // 2. Send message
        const msgResult = discordRequest(
            `https://discord.com/api/v10/channels/${dmResult.json.id}/messages`,
            token,
            { content: message },
            "message send",
            {
                401: "unauthorized (scope)",
                403: "forbidden (channel)",
                429: "rate limited",
            },
            (json) => !!(json?.id || json?.message?.id)
        );
        diagnostics.send = msgResult.diag;
        if (!msgResult.ok) {
            return { ok: false, error: msgResult.error, diagnostics };
        }

        return { ok: true, channel: dmResult.json, message: msgResult.json, diagnostics };
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

