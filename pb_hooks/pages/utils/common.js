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
    if (!blog) return null;

    // Handle PocketBase Record objects (server-side)
    if (typeof blog.getString === 'function') {
        const coverImage = blog.getString('coverImage');
        const collectionId = blog.collectionId || blog.getString('collectionId') || blog.collection?.()?.id;
        const id = blog.id;

        if (coverImage && collectionId && id) {
            return `${getBaseUrl()}/api/files/${collectionId}/${id}/${coverImage}`;
        }
        return null;
    }

    // Handle plain objects (client-side or serialized)
    if (blog.coverImage && blog.collectionId && blog.id) {
        return (
            `${getBaseUrl()}/api/files/${blog.collectionId}/${blog.id}/${blog.coverImage}`
        )
    }
    return null;
}

/**
 * 
 * @param {string} title 
 * @returns {string}
 */
function slugifyTitle(title) {
    if (!title) return '';
    return title
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
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
    const envToken = process?.env?.DISCORD_BOT_TOKEN;
    const envTokenTrimmed = envToken ? envToken.trim() : "";
    if (envTokenTrimmed) {
        return envTokenTrimmed;
    }
    const dbToken = getAdminSetting(POCKET_ADMIN_DISCORD_BOT_TOKEN);
    return dbToken ? dbToken.trim() : null;
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

        const status = res?.status ?? res?.statusCode ?? 0;
        const rawBody = res?.raw ?? res?.body;
        const text = typeof rawBody === "string" ? rawBody : String(rawBody ?? "");
        $app.logger().info("sendDiscordMessage2 response:", "status", status, "body", text);

        if (status !== 200) {
            $app.logger().warn("sendDiscordMessage2 failed, falling back to sendDiscordMessage");
            const result = sendDiscordMessage(message, userId);
            if (!result?.ok) {
                $app.logger().error("Direct Discord send failed:", "error", result?.error, "diagnostics", JSON.stringify(result?.diagnostics ?? {}));
            } else {
                $app.logger().info("Direct Discord send succeeded");
            }
        }
    } catch (error) {
        $app.logger().error("Error sending Discord message via proxy:", "error", error);
        $app.logger().warn("sendDiscordMessage2 threw, falling back to sendDiscordMessage");
        const result = sendDiscordMessage(message, userId);
        if (!result?.ok) {
            $app.logger().error("Direct Discord send failed:", "error", result?.error, "diagnostics", JSON.stringify(result?.diagnostics ?? {}));
        } else {
            $app.logger().info("Direct Discord send succeeded");
        }
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

/**
 * Send an event to Google Analytics 4 Measurement Protocol from the server
 * @param {string} eventName 
 * @param {Object} eventParams 
 * @param {Object|null} req 
 */
function trackGAEvent(eventName, eventParams = {}, req = null) {
    try {
        const { GA_MEASUREMENT_ID } = require(`${__hooks}/pages/utils/constants.js`);
        const measurementId = GA_MEASUREMENT_ID || 'G-6P8M4DJNQL';
        
        let clientId = 'pb_server_client';
        if (req) {
            try {
                let cookies = null;
                if (typeof req.cookies === 'function') {
                    cookies = req.cookies();
                } else if (req.cookies) {
                    cookies = req.cookies;
                }
                if (cookies && cookies._ga) {
                    const gaVal = cookies._ga.value || cookies._ga;
                    const parts = String(gaVal).split('.');
                    if (parts.length >= 4) {
                        clientId = parts.slice(2).join('.');
                    }
                }
            } catch (_) {}
        }

        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}`;
        const payload = {
            client_id: clientId,
            events: [{
                name: eventName,
                params: eventParams
            }]
        };

        if (typeof $http !== 'undefined' && $http.send) {
            $http.send({
                url: url,
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (err) {
        if (typeof $app !== 'undefined' && $app.logger) {
            $app.logger().error('Failed to send GA event from backend', 'error', err);
        }
    }
}

/**
 * Prepares blog posts view data on the server, including server-side GA search tracking
 */
function prepareBlogPostsViewData(blogposts, isHomepage, isClimbing, params = {}, req = null) {
    const query = params?.query || '';
    const hasSearchQuery = !isHomepage && !!query;
    
    if (hasSearchQuery) {
        trackGAEvent('search', {
            search_term: query,
            search_category: isClimbing ? 'climbing' : 'blog'
        }, req);
    }
    
    let heroPost = null;
    let gridPosts = blogposts?.items || [];
    if (isHomepage && gridPosts.length > 0) {
        heroPost = gridPosts[0];
        gridPosts = gridPosts.slice(1);
    }
    
    const hasPosts = !!heroPost || gridPosts.length > 0;
    const hasNoSearchResults = hasSearchQuery && !hasPosts;
    
    let fullParams = hasSearchQuery ? `&query=${encodeURIComponent(query)}` : '';
    if (isClimbing && params?.climbType) {
        fullParams += `&climbType=${encodeURIComponent(params.climbType)}`;
    }
    
    return {
        query,
        hasSearchQuery,
        heroPost,
        gridPosts,
        hasPosts,
        hasNoSearchResults,
        fullParams
    };
}

/**
 * Prepares single blog view data on the server, including metadata updates and GA view_item tracking
 */
function prepareBlogSingleViewData(singleBlog, isClimbing, params = {}, data = {}, req = null) {
    if (!singleBlog && params?.title) {
        try {
            const { getBlogPostsByTitlePrefix, getClimbingLogsByTitlePrefix } = require(`${__hooks}/pages/utils/pocket.js`);
            const firstWord = params.title.split('-')[0].replace(/"/g, '\\"');
            const possibleBlogs = isClimbing 
                ? getClimbingLogsByTitlePrefix(firstWord)
                : getBlogPostsByTitlePrefix(firstWord);

            const targetSlug = params.title.toLowerCase();
            singleBlog = possibleBlogs.find(
                (b) => slugifyTitle(b.getString('title')) === targetSlug
            ) || null;
        } catch (error) {
            console.error('Error fetching single blog post: ', error);
        }
    }

    if (singleBlog && data?.metadata) {
        try {
            const newTitle = isClimbing
                ? `${singleBlog.getString('title')} | Climbing Blog`
                : `${singleBlog.getString('title')} | The Justin Blog`;
                
            data.metadata
                .filter((m) => m.name.includes('title'))
                .forEach((m) => (m.content = newTitle));

            data.metadata
                .filter((m) => m.name === 'og:image' || m.name === 'twitter:image')
                .forEach((m) => (m.content = getImageUrl(singleBlog)));

            const description = singleBlog
                .getString(isClimbing ? 'content' : 'content1')
                .replace(/<[^>]*>/g, '')
                .slice(0, 160)
                .trim();

            data.metadata
                .filter(
                    (m) =>
                        m.name === 'description' ||
                        m.name === 'og:description' ||
                        m.name === 'twitter:description'
                )
                .forEach((m) => (m.content = description));

            if (isClimbing) {
                const climbType = singleBlog.getString('climbType');
                const grade = singleBlog.getString('grade');
                const style = singleBlog.getString('style');
                const location = singleBlog.getString('location');
                const climbTags = [climbType, grade, style, location].filter(Boolean);
                climbTags.forEach((tag) => {
                    data.metadata.push({ name: 'article:tag', content: tag });
                });
                data.metadata.push({ name: 'keywords', content: climbTags.join(', ') });
            } else {
                const blogTags = singleBlog.getString('tags');
                if (blogTags && blogTags.length > 0) {
                    const tags = blogTags.split(';');
                    tags.forEach((tag) => {
                        data.metadata.push({ name: 'article:tag', content: tag.trim() });
                    });
                    data.metadata.push({ name: 'keywords', content: tags.join(', ') });
                }
            }

            const publishedDate = isClimbing
                ? singleBlog.getString('date')
                : singleBlog.getString('manualPublishDate') || singleBlog.getString('created');
            if (publishedDate) {
                data.metadata.push({
                    name: 'article:published_time',
                    content: new Date(publishedDate).toISOString(),
                });
            }

            const updatedDate = singleBlog.getString('updated');
            if (updatedDate) {
                data.metadata.push({
                    name: 'article:modified_time',
                    content: new Date(updatedDate).toISOString(),
                });
            }

            const ogType = data.metadata.find((m) => m.name === 'og:type');
            if (ogType) {
                ogType.content = 'article';
            } else {
                data.metadata.push({ name: 'og:type', content: 'article' });
            }

            trackGAEvent('view_item', {
                event_category: isClimbing ? 'climbing_engagement' : 'blog_engagement',
                item_id: singleBlog.id,
                item_name: singleBlog.getString('title') || '',
                item_category: isClimbing ? (singleBlog.getString('climbType') || '') : (singleBlog.getString('tags') || ''),
                author: 'Justin K'
            }, req);
        } catch (err) {
            console.error('Error preparing single blog view metadata: ', err);
        }
    }

    return singleBlog;
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
    isTicketCreated,
    slugifyTitle,
    trackGAEvent,
    prepareBlogPostsViewData,
    prepareBlogSingleViewData
}

