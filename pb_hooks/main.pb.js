/// <reference path="../pb_data/types.d.ts" />

// Middleware to set HTTP Cache-Control headers for images and static media
routerUse((e) => {
    try {
        const path = String(e?.request?.url?.path || e?.request?.url || "");
        if (
            path.startsWith("/api/files/") ||
            /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2)$/i.test(path)
        ) {
            e.response.header().set("Cache-Control", "public, max-age=31536000, immutable");
        }
    } catch (_) {}
    return e.next();
});

routerAdd("GET", "/api/collection-schedule", (e) => {
    const {
        COLLECTION_CONFIG_URL,
        COLLECTION_CALENDAR_URL,
        COLLECTION_ENDPOINT_HEADERS,
        buildCollectionScheduleResponse,
        formatCollectionDiscordMessage,
        getHttpJson,
    } = require(`${__hooks}/pages/utils/collection.js`);

    const {
        DISCORD_ID_JUSTIN,
        COLLECTION_ENDPOINT_BASE_URL,
        COLLECTION_SUGGEST_URL,
    } = require(`${__hooks}/pages/utils/constants.js`);

    const {
        sendDiscordMessage2,
    } = require(`${__hooks}/pages/utils/common.js`);

    const buildEndpointFromKeyString = (keyString) => {
        return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&keyString=${encodeURIComponent(keyString)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const buildEndpointFromLocation = (location) => {
        return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&singleLine=${encodeURIComponent(location)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const sendHttpOrThrowLocal = (label, requestOptions) => {
        try {
            return $http.send(requestOptions);
        } catch (_) {
            throw new Error(`${label} request failed.`);
        }
    };

    try {
        const resolveCollectionEndpointUrlLocal = () => {
            let location = "5 o'meara court";

            // Normalize common address suffixes to Toronto geocoder abbreviations
            location = location
                .replace(/\bcourt\b/gi, "crt")
                .replace(/\bct\b/gi, "crt")
                .replace(/\bstreet\b/gi, "st")
                .replace(/\broad\b/gi, "rd")
                .replace(/\bavenue\b/gi, "ave")
                .replace(/\bdrive\b/gi, "dr")
                .replace(/\bboulevard\b/gi, "blvd")
                .replace(/\bplace\b/gi, "pl")
                .replace(/\bcrescent\b/gi, "cres");

            const suggestUrl = `${COLLECTION_SUGGEST_URL}?f=json&matchAddress=1&matchPlaceName=1&matchPostalCode=1&addressOnly=0&retRowLimit=100&searchString=${encodeURIComponent(location)}&filter=5`;
            const suggestResponse = sendHttpOrThrowLocal("Toronto suggest", {
                url: suggestUrl,
                headers: COLLECTION_ENDPOINT_HEADERS,
            });
            const suggestJson = getHttpJson(suggestResponse);
            const suggestRows = suggestJson?.result?.rows;
            if (Array.isArray(suggestRows) && suggestRows.length > 0) {
                const keyString = suggestRows[0]?.KEYSTRING ?? suggestRows[0]?.keyString;
                if (keyString) {
                    return buildEndpointFromKeyString(String(keyString));
                }
            }

            return buildEndpointFromLocation(location);
        };

        const geocoderUrl = resolveCollectionEndpointUrlLocal();
        const geocoderResponse = sendHttpOrThrowLocal("Toronto geocoder", {
            url: geocoderUrl,
            headers: COLLECTION_ENDPOINT_HEADERS,
        });
        const configResponse = sendHttpOrThrowLocal("Collection config", {
            url: COLLECTION_CONFIG_URL,
            headers: {
                Accept: "application/json",
            },
        });
        const calendarCsvResponse = sendHttpOrThrowLocal("Collection calendar", {
            url: COLLECTION_CALENDAR_URL,
        });
        const scheduleResponse = buildCollectionScheduleResponse(
            geocoderResponse,
            configResponse,
            calendarCsvResponse,
        );
        const response = {
            statusCode: geocoderResponse.statusCode,
            json: scheduleResponse,
        };

        sendDiscordMessage2(formatCollectionDiscordMessage(response), DISCORD_ID_JUSTIN);

        return e.json(response.statusCode, {
            status: response.statusCode,
            data: response.json ?? response.raw,
        });
    } catch (err) {
        $app.logger().error("Failed to check collection endpoint", "error", err);
        sendDiscordMessage2([
            "Collection status: 502",
            err?.message ?? String(err),
        ].join("\n\n"), DISCORD_ID_JUSTIN);

        return e.json(502, {
            message: "Failed to check collection endpoint.",
            error: err?.message ?? String(err),
        });
    }
});

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        saveZendeskRecord,
    } = require(`${__hooks}/pages/utils/common.js`);

    let data;
    try {
        data = e.requestInfo();
    } catch (err) {
        $app.logger().error("Failed to parse request info", "error", err);
        return e.json(400, { message: "Invalid request" });
    }

    try {
        saveZendeskRecord(data);
    } catch (err) {
        $app.logger().error("Error saving Zendesk record", "error", err);
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
        findRecentTicketsByTicketNumber2,
        getAdminSetting,
        generateNormalTicketMessage,
        isTicketClosed,
        isSlaBreaching,
        getDiscordIdfromData,
        generateSlaBreachingSoonMessage,
        isTicketCreated,
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS,
        DISCORD_ID_JUSTIN
    } = require(`${__hooks}/pages/utils/constants.js`);

    function handleTicketCreated(data) {
        const myMessage = generateNormalTicketMessage(data);
        sendDiscordMessage(`New Ticket: ${myMessage}`);
    }

    function handleSendMessage(data, createdDate = new Date()) {
        const discordId = getDiscordIdfromData(data);
        if (!discordId) {
            return;
        }

        try {
            const settingRaw = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
            const appsettingsDelaySeconds = parseInt(settingRaw, 10);
            const timeInSeconds = isNaN(appsettingsDelaySeconds) ? 10 : appsettingsDelaySeconds;

            const actorId = getActorId(data);
            const assigneeId = getAssigneeId(data);
            const recentTickets = findRecentTicketsByTicketNumber2(data, timeInSeconds, actorId);

            // Check if there are no recent tickets
            if (actorId === assigneeId || isTicketClosed(data)) {
                return;
            }

            if (recentTickets.length > 1 && new Date(recentTickets[0]?.get("created")) < createdDate) {
                return;
            }

            const myMessage = generateNormalTicketMessage(data);
            sendDiscordMessage(myMessage, discordId);
        } catch (error) {
            $app.logger().error(`Error sending ticket update message: ${myMessage}.`, "error", error);
        }
    }

    function handleSLABreaching(data) {
        const discordId = getDiscordIdfromData(data);
        const myMessage = generateSlaBreachingSoonMessage(data);
        if (discordId) {
            sendDiscordMessage(myMessage, discordId);
        }

        if (discordId !== DISCORD_ID_JUSTIN) {
            sendDiscordMessage(myMessage);
        }
    }

    // Get the data field and convert to string
    const data = JSON.parse(e.record.get("data"));
    if (!data) {
        $app.logger().error(`No Data in PocketBase:`, "error");
        return;
    }

    if (isTicketCreated(data)) {
        handleTicketCreated(data);
    }
    else if (isSlaBreaching(data)) {
        handleSLABreaching(data);
    }
    else {
        handleSendMessage(data, new Date(e.record.get("created")));
    }

}, "zendesk_tickets")