/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        getAssigneeId,
        isSlaBreaching,
        runAfterDelay,
        sendDiscordMessage,
        saveZendeskRecord,
        findRecentTicketsByTicketNumber,
        getDiscordIdByAssigneeId,
        getAdminSetting,
        generateNormalTicketMessage,
        generateSlaBreachingSoonMessage,
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS,
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

        if (discordId) {
            try {
                const settingRaw = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
                const appsettingsDelaySeconds = parseInt(settingRaw, 10);
                const recentTickets = findRecentTicketsByTicketNumber(data, isNaN(appsettingsDelaySeconds) ? 10 : appsettingsDelaySeconds);
                if (recentTickets?.length < 1) {
                    const myMessage = generateNormalTicketMessage(data);
                    sendDiscordMessage(myMessage, discordId);
                }
            } catch (error) {
                console.error("Error sending ticket update message:", error);
            }
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
    const DISCORD_API_ENDPOINT = "https://zen.jkim.win/api/discord/send-dm/";
    const DISCORD_ID_JUSTIN = "90909125164163072";

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
            if (status !== 200) {
                console.log("❌ Discord webhook failed:", status);
            } else {
                console.log("✅ Discord message sent!");
            }
        } catch (error) {
            console.error("❌ Error sending Discord message:", error);
        }
    }

    // Get record data safely
    const recordData = {
        id: e.record?.id,
        collection: e.collection?.name,
        ticketId: e.record?.get("ticketId"),
        ticketType: e.record?.get("ticketType"),
    };

    const message = `🆕 New Zendesk Ticket Created!\nCollection: ${recordData.collection}\nTicket ID: ${recordData.ticketId}\nType: ${recordData.ticketType}\nRecord ID: ${recordData.id}`;

    // Send Discord message
    try {
        sendDiscordMessage2(message);
    } catch (error) {
        console.error("❌ Error in Discord notification:", error);
    }
}, "zendesk_tickets")