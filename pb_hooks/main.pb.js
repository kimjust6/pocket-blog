/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        sendDiscordMessage,
        getZendeskUrl,
        getAssigneeId,
        isSlaBreaching
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        saveZendeskRecord,
        findRecentTicketByTicketNumber,
        getDiscordIdByAssigneeId,
        getAdminSetting
    } = require(`${__hooks}/pages/utils/pocketbase.js`);

    const {
        POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS
    } = require(`${__hooks}/pages/utils/constants.js`);


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
                const setting = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
                const recentTicket = findRecentTicketByTicketNumber(data, parseInt(setting));
                if (!recentTicket) {
                    // forward to discord bot
                    sendDiscordMessage(`Your ticket has been updated: ${url ?? 'No URL available'}`);
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

        return e.json(201, { data })
    } catch (err) {
        throw err;
    }

});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})

