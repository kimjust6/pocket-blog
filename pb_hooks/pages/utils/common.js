const {
    POCKET_SLA_BREACHING_SOON,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
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


module.exports = {
    formatDateTime,
    getImageUrl,
    getZendeskUrl,
    isJustinsTicket,
    isSlaBreaching,
    getTicketId,
    getTicketType,
    getAssigneeId,
    runAfterRandomDelay,
}
