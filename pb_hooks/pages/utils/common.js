const {
    POCKET_SLA_BREACHING_SOON,
    DISCORD_API_ENDPOINT,
    ZENDESK_API_ENDPOINT
} = require("./constants");

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

function isJustinsTicket(submitter_id, ticket) {
    const body = ticket?.body ?? ticket;
    return body?.detail?.submitter_id == submitter_id;
}

function isSlaBreaching(ticket) {
    const body = ticket?.body ?? ticket;
    return body?.event?.tags_added?.includes(POCKET_SLA_BREACHING_SOON);
}

function getZendeskUrl(ticketId) {
    if (!ticketId) {
        return null;
    }
    return `${ZENDESK_API_ENDPOINT}${ticketId}`
}

async function sendDiscordMessageAsync(userId, message) {
    const discordApiEndpoint = DISCORD_API_ENDPOINT;
    const payload = {
        userId,
        message,
    };

    try {
        await fetch(discordApiEndpoint, {
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
    sendDiscordMessageAsync
}
