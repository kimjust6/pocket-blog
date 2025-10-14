/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/clippy/zendesk", async (e) => {
    // Queue for processing Zendesk requests sequentially
    const zendeskQueue = [];
    let isProcessingQueue = false;

    async function processZendeskQueue() {
        if (isProcessingQueue || zendeskQueue.length === 0) {
            return;
        }

        isProcessingQueue = true;

        while (zendeskQueue.length > 0) {
            const { e, resolve, reject } = zendeskQueue.shift();

            try {
                const result = await handleZendeskRequest(e);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        isProcessingQueue = false;
    }

    async function handleZendeskRequest(e) {
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
                    // return e.json(201, recentTicket);
                    if (!recentTicket) {
                        // forward to discord bot
                        await sendDiscordMessage(`Your ticket has been updated: ${url || 'No URL available'}`);
                    }
                } catch (error) {
                    console.error("Error sending ticket update message:", error);
                }
            };

            await saveZendeskRecord(data);

            if (isSlaBreaching(data)) {
                try {
                    // forward to discord bot
                    await sendDiscordMessage(`SLA breaching soon: ${url || 'No URL available'}`);
                }
                catch (error) {
                    console.error("Error sending SLA breaching message:", error);
                }
            };

            return { status: 201, data };
        } catch (err) {
            throw err;
        }
    }


    return new Promise((resolve, reject) => {
        zendeskQueue.push({ e, resolve, reject });
        processZendeskQueue();
    }).then(result => {
        return e.json(result.status, result.data);
    }).catch(err => {
        return e.json(500, {
            error: err?.message || "Failed to create Zendesk fticket",
        });
    });
});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})

