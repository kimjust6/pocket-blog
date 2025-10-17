/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        getZendeskUrl,
        getAssigneeId,
        isSlaBreaching,
        runAfterRandomDelay,
        generateNormalTicketMessage
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        sendDiscordMessage,
        saveZendeskRecord,
        findRecentTicketByTicketNumber,
        getDiscordIdByAssigneeId,
        getAdminSetting
    } = require(`${__hooks}/pages/utils/pocketbase.js`);

    const {
        POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS,
        POCKET_ADMIN_MAX_RANDOM_DELAY_IN_SECONDS
    } = require(`${__hooks}/pages/utils/constants.js`);

    let data;
    try {
        data = e.requestInfo();
    } catch (err) {
        console.error("Failed to parse request info", err);
        return e.json(400, { message: "Invalid request" });
    }

    const MAX_RANDOM_DELAY_IN_SECONDS = parseInt(getAdminSetting(POCKET_ADMIN_MAX_RANDOM_DELAY_IN_SECONDS) ?? "3");

    // Return immediately; do async work after random short delay to reduce duplicate race conditions.
    runAfterRandomDelay(() => {
        processTicketUpdate();
    }, MAX_RANDOM_DELAY_IN_SECONDS);

    return e.json(202, { status: "accepted" });

    function processTicketUpdate() {
        try {
            const url = getZendeskUrl(data);
            let discordId = null;
            try {
                const assigneeId = getAssigneeId(data);
                discordId = assigneeId ? getDiscordIdByAssigneeId(assigneeId) : null;
            } catch (error) {
                console.error("Error getting Discord ID from PocketBase:", error);
            }

            if (discordId) {
                try {
                    const settingRaw = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
                    const windowSec = parseInt(settingRaw, 10);
                    const recentTicket = findRecentTicketByTicketNumber(data, isNaN(windowSec) ? 10 : windowSec);
                    if (!recentTicket) {
                        const myMessage = generateNormalTicketMessage(data);
                        sendDiscordMessage(myMessage, discordId);
                    }
                } catch (error) {
                    console.error("Error sending ticket update message:", error);
                }
            }

            try {
                saveZendeskRecord(data);
            } catch (err) {
                console.error("Error saving Zendesk record", err);
            }

            if (isSlaBreaching(data)) {
                try {
                    sendDiscordMessage(`SLA breaching soon: ${url || 'No URL available'}`);
                }
                catch (error) {
                    console.error("Error sending SLA breaching message:", error);
                }
            }
        } catch (err) {
            console.error("Unexpected error in delayed processing", err);
        }
    }
});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})

