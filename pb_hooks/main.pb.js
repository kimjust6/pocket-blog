/// <reference path="../pb_data/types.d.ts" />


routerAdd("POST", "/clippy/zendesk", (e) => {
    // Helper functions
    const {
        sendDiscordMessageAsync,
        getZendeskUrl,
        isJustinsTicket,
        isSlaBreaching
    } = require(`${__hooks}/pages/utils/common.js`);


    try {
        let data = e.requestInfo()
        let collection = $app.findCollectionByNameOrId("zendesk_tickets")

        if (!collection) {
            return e.json(404, { error: "zendesk_tickets collection not found" });
        }

        let record = new Record(collection)

        record.set("data", JSON.stringify(data))
        record.set("created", Date.now())
        record.set("updated", Date.now())

        $app.save(record);

        const submitter_id = "26266016447255";
        const discord_id = "90909125164163072";

        const url = getZendeskUrl(data?.detail?.id);
        if (isJustinsTicket(submitter_id, data)) {
            // forward to discord bot
            sendDiscordMessageAsync(discord_id, `Your ticket has been updated: ${url || 'No URL available'}`);
        };

        if (isSlaBreaching(data)) {
            // forward to discord bot
            sendDiscordMessageAsync(discord_id, `SLA breaching soon: ${url || 'No URL available'}`);
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







