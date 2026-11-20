/// <reference path="../pb_data/types.d.ts" />

// Middleware to set HTTP Cache-Control headers for images and static media, plus defensive security headers
routerUse((e) => {
    try {
        const header = e.response.header();
        header.set("X-Content-Type-Options", "nosniff");
        header.set("X-Frame-Options", "SAMEORIGIN");
        header.set("Referrer-Policy", "strict-origin-when-cross-origin");

        const path = String(e?.request?.url?.path || e?.request?.url || "");
        if (
            path.startsWith("/api/files/") ||
            /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2)$/i.test(path)
        ) {
            header.set("Cache-Control", "public, max-age=31536000, immutable");
        }
    } catch (_) {}
    return e.next();
});

// Topic-specific RSS feed aliases redirecting to /rss.xml with query filters
routerAdd("GET", "/blog/rss.xml", (e) => e.redirect(301, "/rss.xml?topic=blog"));
routerAdd("GET", "/climbing/rss.xml", (e) => e.redirect(301, "/rss.xml?topic=climbing"));

/**
 * Shared helper to resolve Toronto collection schedule, format data, and send Discord alert.
 * Invoked by /api/collection-schedule endpoint and by weekly native cron job.
 */
function fetchAndNotifyCollectionSchedule(locationOverride = "") {
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
        POCKET_ADMIN_COLLECTION_ADDRESS,
    } = require(`${__hooks}/pages/utils/constants.js`);

    const {
        sendDiscordMessage2,
        getAdminSetting,
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

    const envLocation =
        typeof process !== "undefined" ? String(process?.env?.COLLECTION_SCHEDULE_ADDRESS || "").trim() : "";
    const dbLocation = String(getAdminSetting(POCKET_ADMIN_COLLECTION_ADDRESS) || "").trim();
    let location = String(locationOverride || "").trim() || envLocation || dbLocation || "5 o'meara court";

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

    let geocoderUrl = buildEndpointFromLocation(location);
    if (Array.isArray(suggestRows) && suggestRows.length > 0) {
        const keyString = suggestRows[0]?.KEYSTRING ?? suggestRows[0]?.keyString;
        if (keyString) {
            geocoderUrl = buildEndpointFromKeyString(String(keyString));
        }
    }

    const geocoderResponse = sendHttpOrThrowLocal("Toronto geocoder", {
        url: geocoderUrl,
        headers: COLLECTION_ENDPOINT_HEADERS,
    });
    const configResponse = sendHttpOrThrowLocal("Collection config", {
        url: COLLECTION_CONFIG_URL,
        headers: { Accept: "application/json" },
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

    return response;
}

routerAdd("GET", "/api/collection-schedule", (e) => {
    const {
        DISCORD_ID_JUSTIN,
        POCKET_ADMIN_COLLECTION_CRON_SECRET,
    } = require(`${__hooks}/pages/utils/constants.js`);

    const {
        sendDiscordMessage2,
        verifyConfiguredSecret,
    } = require(`${__hooks}/pages/utils/common.js`);

    const auth = verifyConfiguredSecret(
        e,
        "COLLECTION_CRON_SECRET",
        POCKET_ADMIN_COLLECTION_CRON_SECRET,
        ["X-Cron-Secret", "X-Webhook-Secret"]
    );
    if (!auth.authorized) {
        return e.json(401, { error: "Unauthorized" });
    }

    try {
        let queryLocation = "";
        try {
            queryLocation = String(e.requestInfo()?.query?.location || "").trim();
        } catch (_) {}

        const response = fetchAndNotifyCollectionSchedule(queryLocation);

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
        POCKET_ADMIN_ZENDESK_WEBHOOK_SECRET,
    } = require(`${__hooks}/pages/utils/constants.js`);
    const {
        saveZendeskRecord,
        verifyConfiguredSecret,
    } = require(`${__hooks}/pages/utils/common.js`);

    const auth = verifyConfiguredSecret(
        e,
        "ZENDESK_WEBHOOK_SECRET",
        POCKET_ADMIN_ZENDESK_WEBHOOK_SECRET,
        ["X-Webhook-Secret", "X-Zendesk-Webhook-Signature"]
    );
    if (!auth.authorized) {
        return e.json(401, { message: "Unauthorized" });
    }

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

        let myMessage = "";
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

            myMessage = generateNormalTicketMessage(data);
            sendDiscordMessage(myMessage, discordId);
        } catch (error) {
            $app.logger().error(`Error sending ticket update message: ${myMessage || "unknown"}.`, "error", error);
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

}, "zendesk_tickets");

// Weekly autonomous Toronto collection schedule check (runs every Monday at 22:00 UTC)
cronAdd("toronto_collection_weekly", "0 22 * * 1", () => {
    try {
        $app.logger().info("[CRON] Running scheduled Toronto collection schedule check");
        fetchAndNotifyCollectionSchedule();
    } catch (err) {
        $app.logger().error("[CRON] Failed scheduled Toronto collection check", "error", err);
    }
});

// Weekly maintenance cron: prune Zendesk webhook payload records older than 90 days (runs Sunday 03:00 UTC)
cronAdd("purge_old_zendesk_tickets", "0 3 * * 0", () => {
    try {
        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const cutoffIso = cutoffDate.toISOString().replace("T", " ");
        $app.db()
            .newQuery("DELETE FROM zendesk_tickets WHERE created < {:cutoff}")
            .bind({ cutoff: cutoffIso })
            .execute();
        $app.logger().info("[CRON] Successfully pruned old zendesk_tickets records older than 90 days", "cutoff", cutoffIso);
    } catch (err) {
        $app.logger().error("[CRON] Error pruning old zendesk_tickets records", "error", err);
    }
});
