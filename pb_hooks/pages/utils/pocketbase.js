const {
    POCKET_COLLECTION_ZENDESK_TICKETS,
    POCKET_ZENDESKUSER_DISCORDUSER,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
    DISCORD_API_ENDPOINT,
    DISCORD_ID_JUSTIN
}
    = require(`${__hooks}/pages/utils/constants.js`);

const {
    getTicketId,
    getTicketType,
    getAssigneeId
} = require(`${__hooks}/pages/utils/common.js`);


/**
 * 
 * @param {Object} data 
 * @returns 
 */
function saveZendeskRecord(data) {
    if (!data) {
        throw new Error("Invalid collection or data");
    }

    let collection = $app.findCollectionByNameOrId(POCKET_COLLECTION_ZENDESK_TICKETS)

    if (!collection) {
        return e.json(404, { error: "zendesk_tickets collection not found" });
    }

    const assigneeId = parseInt(getAssigneeId(data) ?? "0")

    let record = new Record(collection)
    record.set("data", JSON.stringify(data))
    record.set("ticketId", getTicketId(data))
    record.set("ticketType", getTicketType(data))
    record.set("zendeskUserId", assigneeId)
    record.set("created", Date.now())
    record.set("updated", Date.now())

    $app.save(record);

}


/**
 * 
 * @param {number} data 
 * @param {number} timeInSeconds 
 * @returns 
 */
function findRecentTicketByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return null;
    }

    let record = new Record();
    $app.recordQuery(POCKET_COLLECTION_ZENDESK_TICKETS)
        .andWhere($dbx.hashExp({ "ticketId": ticketId }))
        .orderBy("created DESC")
        .limit(1)
        .one(record)
    // check if the record was created within the last `timeInSeconds` seconds
    if (record) {
        const createdTime = new Date(record.get("created")).getTime();
        const currentTime = Date.now();
        const timeDiff = (currentTime - createdTime)
        if (timeDiff && timeDiff <= timeInSeconds * 1000) {
            return record;
        }
    }
    return null;
}

/**
 * 
 * @param {string} assignee_id 
 * @returns {string|null}
 */
function getDiscordIdByAssigneeId(assignee_id) {
    if (!assignee_id) {
        return null;
    }

    let record = new Record();
    try {

        $app.recordQuery(POCKET_ZENDESKUSER_DISCORDUSER)
            .andWhere($dbx.hashExp({ "zendesk_id": assignee_id }))
            .limit(1)
            .one(record)
    } catch (error) {
        console.error("Error getting Discord ID from PocketBase:", error);
        return null;
    }

    return record.get("discord_id") ?? null;
}

/**
 *
 * @param {string} key
 * @returns {string|null}
 */

function getAdminSetting(key) {
    if (!key) {
        return null;
    }
    let record = new Record();
    try {

        $app.recordQuery(POCKET_COLLECTION_ADMIN_SETTINGS)
            .andWhere($dbx.hashExp({ "key": key }))
            .limit(1)
            .one(record)
    }
    catch (err) {
        console.error("Error querying admin settings:", err);
        return null;
    }

    return record.get("value") ?? null;
}

/**
 * 
 * @returns {string} discord bot token
 */
function getDiscordBotToken() {
    return process?.env?.DISCORD_BOT_TOKEN || getAdminSetting(POCKET_ADMIN_DISCORD_BOT_TOKEN);
}



/**
 *
 * @param {string} message
 * @param {string} userId
 */
function sendDiscordMessage2(message, userId = DISCORD_ID_JUSTIN) {
    const discordApiEndpoint = DISCORD_API_ENDPOINT;
    const payload = {
        userId,
        message,
    };

    try {
        $http.send({
            url: discordApiEndpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Error sending Discord message:", error);
    }
}



/**
 *
 * @param {string} message
 * @param {string} userId
 */
function sendDiscordMessage(message, userId = DISCORD_ID_JUSTIN) {
    const token = getDiscordBotToken();
    if (!token) {
        return { ok: false, error: 'Missing Discord bot token', diagnostics: {} };
    }

    // Small internal helpers
    const decodeBody = (raw) => {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (raw instanceof Uint8Array) { try { return new TextDecoder().decode(raw); } catch { return ''; } }
        if (Array.isArray(raw)) { try { return new TextDecoder().decode(Uint8Array.from(raw)); } catch { return raw.map(n => String.fromCharCode(n)).join(''); } }
        return '';
    };
    const parseJson = (raw) => {
        const txt = decodeBody(raw);
        if (!txt.trim()) return null;
        try { return JSON.parse(txt); } catch (err) { return { _raw: txt.slice(0, 300), _parseError: err.message }; }
    };
    const readStatus = (res) => res?.status ?? res?.statusCode ?? res?.code ?? null;
    const mkError = (phase, status, extra) => `${phase} failed: ${extra || ('HTTP ' + status)}`;

    const diagnostics = {};
    try {
        // 1. Create DM channel
        const dmRes = $http.send({
            url: 'https://discord.com/api/v10/users/@me/channels',
            method: 'POST',
            headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: userId })
        });
        const dmStatus = readStatus(dmRes);
        const dmJson = parseJson(dmRes.body);
        diagnostics.dm = {
            status: dmStatus,
            keys: Object.keys(dmRes || {}),
            preview: decodeBody(dmRes.body).slice(0, 120),
            parsedHasId: !!dmJson?.id,
            parseError: dmJson?._parseError
        };
        const dmOk = (dmStatus === 200) || (!dmStatus && dmJson?.id);
        if (!dmOk) {
            const reason = dmStatus === 401 ? 'unauthorized (token)' : dmStatus === 403 ? 'forbidden (privacy / no mutual server)' : dmStatus === 429 ? 'rate limited' : 'HTTP ' + dmStatus;
            return { ok: false, error: mkError('channel create', dmStatus, reason), diagnostics };
        }
        if (!dmJson || dmJson._parseError || !dmJson.id) {
            return { ok: false, error: 'channel create parse error', diagnostics };
        }

        // 2. Send message
        const msgRes = $http.send({
            url: `https://discord.com/api/v10/channels/${dmJson.id}/messages`,
            method: 'POST',
            headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message })
        });
        const msgStatus = readStatus(msgRes);
        const msgJson = parseJson(msgRes.body);
        diagnostics.send = {
            status: msgStatus,
            keys: Object.keys(msgRes || {}),
            preview: decodeBody(msgRes.body).slice(0, 120),
            parsedHasId: !!msgJson?.id,
            parseError: msgJson?._parseError
        };
        const msgOk = (msgStatus === 200) || (!msgStatus && (msgJson?.id || msgJson?.message?.id));
        if (!msgOk) {
            const reason = msgStatus === 401 ? 'unauthorized (scope)' : msgStatus === 403 ? 'forbidden (channel)' : msgStatus === 429 ? 'rate limited' : 'HTTP ' + msgStatus;
            return { ok: false, error: mkError('message send', msgStatus, reason), diagnostics };
        }
        if (!msgJson || msgJson._parseError) {
            return { ok: false, error: 'message parse error', diagnostics };
        }

        return { ok: true, channel: dmJson, message: msgJson, diagnostics };
    } catch (err) {
        return { ok: false, error: err?.message || String(err), diagnostics };
    }
}


module.exports = {
    saveZendeskRecord,
    findRecentTicketByTicketNumber,
    getDiscordIdByAssigneeId,
    getAdminSetting,
    getDiscordBotToken,
    sendDiscordMessage,
    sendDiscordMessage2
}