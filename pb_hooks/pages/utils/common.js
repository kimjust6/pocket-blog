const {
    POCKET_SLA_BREACHING_SOON,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    POCKET_COLLECTION_ZENDESK_TICKETS,
    POCKET_ZENDESKUSER_DISCORDUSER,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
    DISCORD_API_ENDPOINT,
    DISCORD_ID_JUSTIN,
    POCKET_COLLECTION_ZENDESK_ORGANIZATIONS,
    ZENDESK_STATUS_CHANGED_TYPE,
    ZENDESK_CLOSED_STATUS,
    ZENDESK_TICKET_CREATED
} = require(`${__hooks}/pages/utils/constants.js`);


/**
 * 
 * @param {Object} data 
 * @returns {Object|null}
 */
function privateGetBody(data) {
    // Handle both webhook format and stored record format
    // Webhook format: data.body.body or data.body
    // Stored format: data (already at the body level)

    // If data has body.body structure (webhook format)
    if (data?.body?.body) {
        return data.body.body;
    }

    // If data has body structure (webhook format)
    if (data?.body) {
        return data.body;
    }

    // If data has detail directly (stored format after JSON.parse)
    if (data?.detail) {
        return data;
    }

    // Otherwise return data as-is (might be the body itself)
    return data ?? null;
}

/**
 *
 * @param {Object} data
 * @returns {boolean}
 */
function privateIsStatusChangedEvent(data) {
    const body = privateGetBody(data);
    return body?.type === ZENDESK_STATUS_CHANGED_TYPE;
}

function isTicketClosed(data) {
    const body = privateGetBody(data);
    return privateIsStatusChangedEvent(data)
        && body?.detail?.status === ZENDESK_CLOSED_STATUS;
}

/**
 *
 * @param {Object} data
 * @returns {number}
 */
function getTicketId(data) {
    const body = privateGetBody(data);
    // Try multiple paths to find ticket ID
    let ticketId = body?.detail?.id ?? body?.id ?? body?.subject ?? "0";

    // If it's already a number, return it
    if (typeof ticketId === 'number') {
        return ticketId;
    }

    // If it's a string with format like "Ticket: 12345", extract the number
    if (typeof ticketId === 'string') {
        ticketId = ticketId.split(":").pop().trim();
    }

    return parseInt(ticketId) || 0;
}

/**
 *
 * @param {Object} data
 * @returns {string|null}
 */
function getTicketTitle(data) {
    const body = privateGetBody(data);
    return body?.detail?.subject ?? body?.subject ?? null;
}

/**
 *
 * @param {Object} data
 * @returns {string|null}
 */
function getTicketType(data) {
    const body = privateGetBody(data);
    return body?.type ?? body?.detail?.type ?? null;
}

function formatDateTime(date) {
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ]

    const month = months[date.getMonth()]
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${month} ${day}, ${year}`
}

function getBaseUrl() {
    return 'https://www.jkim.win';
}

/**
 * 
 * @param {Object} blog 
 * @returns {string|null}
 */
function getImageUrl(blog) {
    if (blog && blog?.coverImage && blog?.collectionId && blog?.id) {
        return (
            `${getBaseUrl()}/api/files/${blog.collectionId}/${blog.id}/${blog.coverImage}`
        )
    }
    return null;
}

/**
 *
 * @param {Object} data
 * @param {string} assignee_id
 * @returns {boolean}
 */
function isJustinsTicket(data, assignee_id = ZENDESK_ASSIGNEE_ID_JUSTIN) {
    // get zendesk_user_id from data from collection
    // const zendeskUserId = $app.collection("zendeskuser_discorduser").findOne({ description: "justin.kim@verndale.com" })?.zendesk_id;
    const body = privateGetBody(data);
    return body?.detail?.assignee_id === assignee_id;
}

/**
 * 
 * @param {Object} data 
 * @returns {string|null}
 */
function getAssigneeId(data) {
    const body = privateGetBody(data);
    return body?.detail?.assignee_id ?? body?.assignee_id ?? null;
}

/**
 * 
 * @param {Object} data 
 * @returns {string|null}
 */
function getActorId(data) {
    const body = privateGetBody(data);
    return body?.detail?.actor_id ?? body?.actor_id ?? null;
}

/**
 * 
 * @param {Object} ticket 
 * @returns {boolean}
 */
function isSlaBreaching(ticket) {
    const body = privateGetBody(ticket);
    const tagsAdded = body?.event?.tags_added ?? body?.tags_added ?? [];
    return Array.isArray(tagsAdded) && tagsAdded.includes(POCKET_SLA_BREACHING_SOON);
}

/**
 *
 * @param {Object} data
 * @returns {string|null}
 */
function getZendeskUrl(data) {
    let ticketId = getTicketId(data);
    if (!ticketId) {
        return null;
    }
    return `${ZENDESK_API_ENDPOINT}${ticketId}`
}

/**
 * Execute a function after a random delay (0..maxSeconds) using PocketBase cron.
 * Falls back to 1 second window if invalid maxSeconds provided.
 * @param {Function} fn callback to execute
 * @param {number} maxSeconds upper bound of random delay window (seconds)
 */
function runAfterRandomDelay(fn, maxSeconds = 1) {
    try {
        if (typeof fn !== 'function') {
            $app.logger().error('runAfterRandomDelay: fn must be a function');
            return;
        }
        let windowSec = parseFloat(maxSeconds);
        if (isNaN(windowSec) || windowSec < 0) {
            windowSec = 1;
        }
        const delayInSeconds = Math.random() * windowSec; // 0..maxSeconds (ms)
        runAfterDelay(fn, delayInSeconds);
    } catch (err) {
        $app.logger().error('runAfterRandomDelay setup failed', 'error', err);
    }
}


/**
 * Execute a function after delay using PocketBase cron.
 * Falls back to 1 second window if invalid maxSeconds provided.
 * @param {Function} fn callback to execute
 * @param {number} delayInSeconds upper bound of random delay window (seconds)
 */
function runAfterDelay(fn, delayInSeconds = 4) {
    try {
        const delayMs = delayInSeconds * 1000;
        if (typeof setTimeout === 'function') {
            setTimeout(() => {
                try { fn(); } catch (err) { $app.logger().error('runAfterDelay execution error', 'error', err); }
            }, delayMs);
        } else {
            // Fallback: execute immediately if timers unsupported.
            try { fn(); } catch (err) { $app.logger().error('runAfterDelay immediate fallback error', 'error', err); }
        }
    } catch (err) {
        $app.logger().error('runAfterDelay setup failed', 'error', err);
    }
}


// pocketbase.js

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
    const actorId = parseInt(getActorId(data) ?? "0")

    let record = new Record(collection)
    record.set("data", JSON.stringify(data))
    record.set("ticketId", getTicketId(data))
    record.set("ticketType", getTicketType(data))
    record.set("zendeskUserId", assigneeId)
    record.set("zendeskActorId", actorId)
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
        .andWhere($dbx.rangeExp("created", Date.now() - timeInSeconds * 1000, Date.now()))
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
 * @param {number} data 
 * @param {number} timeInSeconds 
 * @returns {Array|null}
 */
function findRecentTicketsByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return [];
    }
    const now = Date.now();
    const dateStart = now - timeInSeconds * 1000;
    const dateEnd = now;

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        "ticketId = {:ticketId} && created >= {:dateStart} && created <= {:dateEnd}",
        "created",
        20,
        0,
        {
            "ticketId": ticketId,
            "dateStart": dateStart,
            "dateEnd": dateEnd
        }
    );

    return records || [];
}

/**
 * 
 * @param {number} data 
 * @param {number} timeInSeconds 
 * @returns {Array|null}
 */
function findRecentTicketsByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return [];
    }
    const now = Date.now();
    const dateStart = now - timeInSeconds * 1000;
    const dateEnd = now;

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        "ticketId = {:ticketId} && created >= {:dateStart} && created <= {:dateEnd}",
        "created",
        20,
        0,
        {
            "ticketId": ticketId,
            "dateStart": dateStart,
            "dateEnd": dateEnd
        }
    );

    return records || [];
}

/**
 * Find recent tickets by Zendesk ticketId.
 * @param {number|string|object} data 
 * @param {number} timeInSeconds 
 * @returns {Array}
 */
function findRecentTicketsByTicketNumber2(data, timeInSeconds = 10, actorId = null) {
    let ticketId = typeof data === "number" ? data : getTicketId(data);
    if (ticketId == null) return [];

    // PocketBase expects UTC datetime like "2025-11-02 15:45:22.123Z"
    const now = new Date();
    const dateStart = new Date(now.getTime() - timeInSeconds * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "Z"); // ensures space separator instead of 'T'

    let filter = `ticketId = ${ticketId} && created >= "${dateStart}"`;
    if (actorId) {
        filter += ` && zendeskActorId = "${actorId}"`;
    }

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        filter,
        "created",
        20,
        0
    );

    return records || [];
}

/**
 * 
 * @param {string} assignee_id 
 * @returns {string|null}
 */
function getDiscordIdByAssigneeId(assignee_id) {
    if (!assignee_id) {
        $app.logger().info("No assignee_id provided");
        return null;
    }

    try {
        const records = $app.findRecordsByFilter(
            POCKET_ZENDESKUSER_DISCORDUSER,
            "zendesk_id = {:assigneeId}",
            "-created",
            1,
            0,
            { "assigneeId": String(assignee_id) }
        );

        $app.logger().info("Found records:", "count", records?.length ?? 0);

        if (records && records.length > 0) {
            const discordId = records[0].get("discord_id");
            $app.logger().info("Discord ID found:", "discordId", discordId);
            return discordId ?? null;
        }
        return null;
    } catch (error) {
        $app.logger().error("Error getting Discord ID from PocketBase:", "error", error);
        return null;
    }
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
        $app.logger().error("Error querying admin settings:", "error", err);
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
    * Send Discord message using external API endpoint
    * @param {string} message - The message to send
    * @param {string} userId - Discord user ID
    */
function sendDiscordMessage2(message, userId = DISCORD_ID_JUSTIN) {
    const payload = {
        userId,
        message,
    };
    try {
        const res = $http.send({
            url: DISCORD_API_ENDPOINT,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        // const status = res?.status ?? res?.statusCode ?? 0;
    } catch (error) {
        $app.logger().error("Error sending Discord message:", "error", error);
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

/**
 * 
 * @param {string | int} id 
 * returns {string | null}
 */
function getOrganizationById(id) {
    if (!id) {
        return null;
    }

    let record = new Record();
    try {
        $app.recordQuery(POCKET_COLLECTION_ZENDESK_ORGANIZATIONS)
            .andWhere($dbx.hashExp({ organizationId: id }))
            .limit(1)
            .one(record);

        // check if record has data
        if (!record || !record.get("id")) {
            return null;
        }

        return record.get("shortHand") ?? null;
    } catch (err) {
        $app.logger().error("Error getting organization:", "error", err);
        return null;
    }
}


function generateNormalTicketMessage(data) {
    organizationName = getOrganizationName(data) ?? "Updated"
    const title = getTicketTitle(data);
    const id = getTicketId(data);
    const url = getZendeskUrl(data);
    if (url && id && title) {
        return ` ${organizationName} | ${id}: [${title}](${url})`;
    }
    else {
        return `Your ticket has been updated: ${url ?? 'No URL available'}`;
    }
}

function generateSlaBreachingSoonMessage(data) {
    const organizationName = `Check SLA ${getOrganizationName(data)}` ?? "Check SLA";
    const title = getTicketTitle(data);
    const id = getTicketId(data);
    const url = getZendeskUrl(data);
    if (url && id && title) {
        return ` ${organizationName} | ${id}: [${title}](${url})`;
    }
    else {
        return `SLA breaching soon: ${url ?? 'No URL available'}`;
    }
}

/**
 * 
 * @param {Object} data 
 */
function getOrganizationName(data) {
    const body = privateGetBody(data);
    const id = body?.detail?.organization_id ?? body?.organization_id ?? null;
    return getOrganizationById(id);
}

function getDiscordIdfromData(data) {
    const assigneeId = getAssigneeId(data);
    if (!assigneeId) {
        $app.logger().error(`Error getting assigneeId from Data in PocketBase:`, "error");
        return null;
    }

    try {
        discordId = getDiscordIdByAssigneeId(assigneeId);
    } catch (error) {
        $app.logger().error(`2: Error getting Discord ID for assignee: ${assigneeId} from PocketBase:`, "error", error);
    }

    if (!discordId) {
        return null;
    }

    return discordId;
}

function isTicketCreated(data) {
    const body = privateGetBody(data);
    return body?.type === ZENDESK_TICKET_CREATED;
}

module.exports = {
    formatDateTime,
    getImageUrl,
    getZendeskUrl,
    isJustinsTicket,
    isSlaBreaching,
    getTicketId,
    getTicketType,
    getAssigneeId,
    getActorId,
    runAfterRandomDelay,
    runAfterDelay,
    privateGetBody,
    privateIsStatusChangedEvent,
    saveZendeskRecord,
    findRecentTicketByTicketNumber,
    findRecentTicketsByTicketNumber,
    findRecentTicketsByTicketNumber2,
    getDiscordIdByAssigneeId,
    getAdminSetting,
    getDiscordBotToken,
    sendDiscordMessage,
    getOrganizationById,
    sendDiscordMessage2,
    generateNormalTicketMessage,
    generateSlaBreachingSoonMessage,
    isTicketClosed,
    getDiscordIdfromData,
    isTicketCreated
}
