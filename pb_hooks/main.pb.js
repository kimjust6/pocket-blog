/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        getAssigneeId,
        isSlaBreaching,
        runAfterDelay,
        sendDiscordMessage,
        saveZendeskRecord,
        getDiscordIdByAssigneeId,
        getAdminSetting,
        generateSlaBreachingSoonMessage,
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        POCKET_ADMIN_MAX_RANDOM_DELAY_IN_SECONDS,
    } = require(`${__hooks}/pages/utils/constants.js`);

    let data;
    try {
        data = e.requestInfo();
    } catch (err) {
        console.error("Failed to parse request info", err);
        return e.json(400, { message: "Invalid request" });
    }

    try {
        saveZendeskRecord(data);
    } catch (err) {
        console.error("Error saving Zendesk record", err);
    }

    const MAX_RANDOM_DELAY_IN_SECONDS = parseInt(getAdminSetting(POCKET_ADMIN_MAX_RANDOM_DELAY_IN_SECONDS) ?? "3");

    // Return immediately; do async work after random short delay to reduce duplicate race conditions.
    runAfterDelay(() => {
        processTicketUpdate();
    }, MAX_RANDOM_DELAY_IN_SECONDS);


    function processTicketUpdate() {
        let discordId = null;
        try {
            const assigneeId = getAssigneeId(data);
            discordId = assigneeId ? getDiscordIdByAssigneeId(assigneeId) : null;
        } catch (error) {
            console.error("Error getting Discord ID from PocketBase:", error);
        }


        if (isSlaBreaching(data)) {
            try {
                const myMessage = generateSlaBreachingSoonMessage(data);
                sendDiscordMessage(myMessage);
            }
            catch (error) {
                console.error("Error sending SLA breaching message:", error);
            }
        }
    }
    return e.json(202, { status: "accepted" });

});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})


// Hook for when a new zendesk_tickets record is created
onRecordAfterCreateSuccess((e) => {
    const {
        getAssigneeId,
        getActorId,
        sendDiscordMessage,
        // findRecentTicketsByTicketNumber2,
        getDiscordIdByAssigneeId,
        // getAdminSetting,
        generateNormalTicketMessage,
        isTicketClosed
    } = require(`${__hooks}/pages/utils/common.js`);
    // const {
    //     POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS
    // } = require(`${__hooks}/pages/utils/constants.js`);

    // Get the data field and convert to string
    const data = JSON.parse(e.record.get("data"));

    let discordId = null;

    if (!data) {
        return;
    }

    const assigneeId = getAssigneeId(data);
    if (!assigneeId) {
        return;
    }

    try {
        discordId = getDiscordIdByAssigneeId(assigneeId);
    } catch (error) {
        console.error("Error getting Discord ID from PocketBase:", error);
    }

    if (!discordId) {
        return;
    }
    try {
        // const settingRaw = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
        // const appsettingsDelaySeconds = parseInt(settingRaw, 10);
        // const timeInSeconds = isNaN(appsettingsDelaySeconds) ? 10 : appsettingsDelaySeconds;

        const actorId = getActorId(data);
        // const recentTickets = findRecentTicketsByTicketNumber2(data, timeInSeconds, actorId);
        // Check if there are no recent tickets

        if (actorId === assigneeId || isTicketClosed(data)) {
            return;
        }

        const myMessage = generateNormalTicketMessage(data);
        sendDiscordMessage(myMessage, discordId);
    } catch (error) {
        console.error("Error sending ticket update message:", error);
    }

}, "zendesk_tickets")