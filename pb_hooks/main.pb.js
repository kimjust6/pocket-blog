/// <reference path="../pb_data/types.d.ts" />


routerAdd("POST", "/clippy/zendesk", (e) => {
    // Helper functions
    const {
        sendDiscordMessage,
        getZendeskUrl,
        isJustinsTicket,
        isSlaBreaching
    } = require(`${__hooks}/pages/utils/common.js`);

    const { saveZendeskRecord }
        = require(`${__hooks}/pages/utils/pocketbase.js`);


    try {
        let data = e.requestInfo()
        saveZendeskRecord(data);

        const url = getZendeskUrl(data);

        if (isJustinsTicket(data)) {
            // forward to discord bot
            sendDiscordMessage(`Your ticket has been updated: ${url || 'No URL available'}`);
        };

        if (isSlaBreaching(data)) {
            // forward to discord bot
            sendDiscordMessage(`SLA breaching soon: ${url || 'No URL available'}`);
        };

        return e.json(201, data);
        // return e.json(201, { message: "Ticket received", data: data });
    } catch (err) {
        return e.json(500, {
            error: err?.message || "Failed to create Zendesk ticket",
        });
    }
});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})







