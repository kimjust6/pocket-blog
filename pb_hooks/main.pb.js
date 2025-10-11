/// <reference path="../pb_data/types.d.ts" />


routerAdd("POST", "/clippy/zendesk", (e) => {
    // Helper functions
    const {
        sendDiscordMessage,
        getZendeskUrl,
        getAssigneeId,
        isSlaBreaching
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        saveZendeskRecord,
        findRecentTicketByTicketNumber,
        getDiscordIdByAssigneeId
    } = require(`${__hooks}/pages/utils/pocketbase.js`);


    try {
        let data = e.requestInfo()
        const url = getZendeskUrl(data);

        let assigneeId
        let discordId
        try {

            assigneeId = getAssigneeId(data);
            discordId = getDiscordIdByAssigneeId(assigneeId);
        }
        catch (error) {
            console.error("Error getting Discord ID from PocketBase:", error);
        }

        if (discordId) {
            try {
                // check if the a ticket with the same number has been created in the last 10 seconds
                const recentTicket = findRecentTicketByTicketNumber(data);
                if (!recentTicket) {
                    // forward to discord bot
                    sendDiscordMessage(`Your ticket has been updated: ${url || 'No URL available'}`);
                }
            } catch (error) {
                console.error("Error sending ticket update message:", error);
            }
        };

        saveZendeskRecord(data);

        if (isSlaBreaching(data)) {
            try {
                // forward to discord bot
                sendDiscordMessage(`SLA breaching soon: ${url || 'No URL available'}`);
            }
            catch (error) {
                console.error("Error sending SLA breaching message:", error);
            }
        };

        return e.json(201, data);
    } catch (err) {
        return e.json(500, {
            error: err?.message || "Failed to create Zendesk fticket",
        });
    }
});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})

