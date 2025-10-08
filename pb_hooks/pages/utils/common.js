const {
    POCKET_SLA_BREACHING_SOON,
    DISCORD_API_ENDPOINT,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    DISCORD_ID_JUSTIN
} = require(`${__hooks}/pages/utils/constants.js`);

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

function getImageUrl(blog) {
    if (blog && blog?.coverImage && blog?.collectionId && blog?.id) {

        return (
            `/api/files/${blog.collectionId}/${blog.id}/${blog.coverImage}`
        )
    }
    return null;
}

function isJustinsTicket(data, assignee_id = ZENDESK_ASSIGNEE_ID_JUSTIN) {
    // get zendesk_user_id from data from collection
    // const zendeskUserId = $app.collection("zendeskuser_discorduser").findOne({ description: "justin.kim@verndale.com" })?.zendesk_id;
    const body = data?.body?.body ?? data?.body;
    return body?.detail?.assignee_id === assignee_id;
}

function isSlaBreaching(ticket) {
    const body = ticket?.body?.body ?? ticket?.body;
    return body?.event?.tags_added?.includes(POCKET_SLA_BREACHING_SOON);
}

function getZendeskUrl(data) {
    const body = data?.body?.body ?? data?.body;
    let ticketId = body?.detail?.id ?? body?.subject ?? null;
    //delimit and get last part"
    ticketId = ticketId.split(":").pop();

    if (!ticketId) {
        return null;
    }
    return `${ZENDESK_API_ENDPOINT}${ticketId}`
}

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

module.exports = {
    formatDateTime,
    getImageUrl,
    getZendeskUrl,
    isJustinsTicket,
    isSlaBreaching,
    sendDiscordMessage
}
