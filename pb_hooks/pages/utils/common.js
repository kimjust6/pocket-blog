const { getAdminSetting } = require("./pocketbase");

const {
    POCKET_SLA_BREACHING_SOON,
    DISCORD_API_ENDPOINT,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    DISCORD_ID_JUSTIN,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
} = require(`${__hooks}/pages/utils/constants.js`);


/**
 * 
 * @param {Object} data 
 * @returns {Object|null}
 */
function privateGetBody(data) {
    return data?.body?.body ?? data?.body ?? null;
}

/**
 *
 * @param {Object} data
 * @returns {number}
 */
function getTicketId(data) {
    const body = privateGetBody(data);
    let ticketId = body?.subject ?? body?.detail?.id ?? "0";
    //delimit and get last part"
    ticketId = ticketId.split(":").pop();
    return parseInt(ticketId);
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
    return body?.detail?.assignee_id ?? null;
}

/**
 * 
 * @param {Object} ticket 
 * @returns {boolean}
 */
function isSlaBreaching(ticket) {
    const body = privateGetBody(ticket);
    return body?.event?.tags_added?.includes(POCKET_SLA_BREACHING_SOON);
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
 *
 * @param {string} message
 * @param {string} userId
 */
function sendDiscordMessage(message, userId = DISCORD_ID_JUSTIN) {
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
 * Execute a function after a random delay (0..maxSeconds) using PocketBase cron.
 * Falls back to 1 second window if invalid maxSeconds provided.
 * @param {Function} fn callback to execute
 * @param {number} maxSeconds upper bound of random delay window (seconds)
 */
function runAfterRandomDelay(fn, maxSeconds = 1) {
    try {
        if (typeof fn !== 'function') {
            console.error('runAfterRandomDelay: fn must be a function');
            return;
        }
        let windowSec = parseFloat(maxSeconds);
        if (isNaN(windowSec) || windowSec < 0) {
            windowSec = 1;
        }
        const delayMs = Math.random() * windowSec * 1000; // 0..maxSeconds (ms)
        if (typeof setTimeout === 'function') {
            setTimeout(() => {
                try { fn(); } catch (err) { console.error('runAfterRandomDelay execution error', err); }
            }, delayMs);
        } else {
            // Fallback: execute immediately if timers unsupported.
            try { fn(); } catch (err) { console.error('runAfterRandomDelay immediate fallback error', err); }
        }
    } catch (err) {
        console.error('runAfterRandomDelay setup failed', err);
    }
}

/**
 * 
 * @returns {string} discord bot token
 */
function getDiscordBotToken() {
    return process?.env?.DISCORD_BOT_TOKEN || getAdminSetting(POCKET_ADMIN_DISCORD_BOT_TOKEN);
}

function sendDiscordMessage2(message, userId = DISCORD_ID_JUSTIN) {
    // Use server-side helper to fetch the Discord Bot token (kept out of source)
    const DISCORD_BOT_TOKEN = getDiscordBotToken()

    let result = null
    let dmChannel = null
    let diagnostics = {}

    function decodeBody(raw) {
        if (raw == null) return ''
        if (typeof raw === 'string') return raw
        if (raw instanceof Uint8Array) {
            try {
                return new TextDecoder().decode(raw)
            } catch {
                return ''
            }
        }
        if (Array.isArray(raw)) {
            try {
                return new TextDecoder().decode(Uint8Array.from(raw))
            } catch {
                return raw.map((n) => String.fromCharCode(n)).join('')
            }
        }
        return ''
    }

    function safeParse(raw) {
        const text = decodeBody(raw)
        if (!text.trim()) return null
        try {
            return JSON.parse(text)
        } catch (err) {
            return { _raw: text.slice(0, 500), _parseError: err.message }
        }
    }

    try {
        if (!DISCORD_BOT_TOKEN) {
            throw new Error(
                'Missing Discord bot token (configure in admin settings)'
            )
        }

        // Step 1: Create DM channel
        const dmResponse = $http.send({
            url: 'https://discord.com/api/v10/users/@me/channels',
            method: 'POST',
            headers: {
                Authorization: 'Bot ' + DISCORD_BOT_TOKEN,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recipient_id: userId }),
        })
        const dmStatus =
            dmResponse.status ??
            dmResponse.statusCode ??
            dmResponse.code ??
            null
        const dmJson = safeParse(dmResponse.body)
        diagnostics.dm = {
            status: dmStatus,
            responseKeys: Object.keys(dmResponse || {}),
            rawBodyPreview: decodeBody(dmResponse.body).slice(0, 200),
            parsed: dmJson,
        }
        const channelId = dmJson && dmJson.id
        const isSuccess = dmStatus === 200 || (!dmStatus && channelId)
        if (!isSuccess) {
            const reason =
                dmStatus === 401
                    ? 'Unauthorized (check bot token)'
                    : dmStatus === 403
                        ? 'Forbidden (privacy settings / no mutual server)'
                        : dmStatus === 429
                            ? 'Rate limited'
                            : 'HTTPS ' + dmStatus
            throw new Error('Failed to create DM channel: ' + reason)
        }
        if (!dmJson || dmJson._parseError) {
            throw new Error('DM channel response could not be parsed')
        }
        dmChannel = dmJson

        if (!dmChannel || !dmChannel.id) {
            throw new Error('DM channel response malformed or missing id')
        }

        // Step 2: Send message
        const sendResponse = $http.send({
            url: `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
            method: 'POST',
            headers: {
                Authorization: 'Bot ' + DISCORD_BOT_TOKEN,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: message }),
        })
        const sendStatus =
            sendResponse.status ??
            sendResponse.statusCode ??
            sendResponse.code ??
            null
        const sendJson = safeParse(sendResponse.body)
        diagnostics.send = {
            status: sendStatus,
            responseKeys: Object.keys(sendResponse || {}),
            rawBodyPreview: decodeBody(sendResponse.body).slice(0, 200),
            parsed: sendJson,
        }
        const sendId = sendJson && (sendJson.id || sendJson.message?.id)
        const sendSuccess = sendStatus === 200 || (!sendStatus && sendId)
        if (!sendSuccess) {
            const reason =
                sendStatus === 401
                    ? 'Unauthorized (token invalid or missing scope)'
                    : sendStatus === 403
                        ? 'Forbidden (cannot send to that channel)'
                        : sendStatus === 429
                            ? 'Rate limited'
                            : 'HTTPS ' + sendStatus
            throw new Error('Failed to send message: ' + reason)
        }
        if (!sendJson || sendJson._parseError) {
            throw new Error('Message response could not be parsed')
        }
        result = sendJson
    } catch (err) {
        error = err?.message || String(err)
    }
    return result
}


module.exports = {
    formatDateTime,
    getImageUrl,
    getZendeskUrl,
    isJustinsTicket,
    isSlaBreaching,
    sendDiscordMessage,
    getTicketId,
    getTicketType,
    getAssigneeId,
    runAfterRandomDelay,
    getDiscordBotToken,
    sendDiscordMessage2
}
