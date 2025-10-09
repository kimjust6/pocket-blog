/// <reference path="../pb_data/types.d.ts" />


routerAdd("POST", "/clippy/zendesk", (e) => {
    // Helper functions
    const {
        sendDiscordMessage,
        getZendeskUrl,
        isJustinsTicket,
        isSlaBreaching
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        saveZendeskRecord,
        findRecentTicketByTicketNumber
    } = require(`${__hooks}/pages/utils/pocketbase.js`);


    try {
        let data = e.requestInfo()
        saveZendeskRecord(data);

        const url = getZendeskUrl(data);

        if (isJustinsTicket(data)) {
            // check if the a ticket with the same number has been created in the last 10 seconds
            const recentTicket = findRecentTicketByTicketNumber(data);
            if (!recentTicket) {
                // forward to discord bot
                sendDiscordMessage(`Your ticket has been updated: ${url || 'No URL available'}`);
            }
        };

        if (isSlaBreaching(data)) {
            // forward to discord bot
            sendDiscordMessage(`SLA breaching soon: ${url || 'No URL available'}`);
        };

        return e.json(201, data);
    } catch (err) {
        return e.json(500, {
            error: err?.message || "Failed to create Zendesk fticket",
        });
    }
});

routerAdd("GET", "/clippy/zendesk", (e) => {
    // const {
    //     findRecentTicketByTicketNumber
    // } = require(`${__hooks}/pages/utils/pocketbase.js`);
    // const nice = findRecentTicketByTicketNumber(8000, 1440000) ?? "";
    // return e.json(200, {
    //     message: nice,
    // });
    return e.json(405, { "message": "Method not allowed." })
})







