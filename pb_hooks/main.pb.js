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

// Topic-specific RSS feed aliases and canonical sitemap redirects
routerAdd("GET", "/blog/rss.xml", (e) => e.redirect(301, "/rss.xml?topic=blog"));
routerAdd("GET", "/climbing/rss.xml", (e) => e.redirect(301, "/rss.xml?topic=climbing"));
routerAdd("GET", "/sitemap", (e) => e.redirect(301, "/sitemap.xml"));
routerAdd("GET", "/sitemap_index.xml", (e) => e.redirect(301, "/sitemap-index.xml"));

routerAdd("GET", "/api/collection-schedule", (e) => {
    const {
        DISCORD_ID_JUSTIN,
        POCKET_ADMIN_COLLECTION_CRON_SECRET,
    } = require(`${__hooks}/pages/utils/constants.js`);

    const {
        sendDiscordMessage2,
        verifyConfiguredSecret,
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        fetchAndNotifyCollectionSchedule,
    } = require(`${__hooks}/pages/utils/collection.js`);

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
    const { processZendeskTicketEvent } = require(`${__hooks}/pages/utils/common.js`);

    const data = JSON.parse(e.record.get("data"));
    if (!data) {
        $app.logger().error(`No Data in PocketBase:`, "error");
        return;
    }

    processZendeskTicketEvent(data, new Date(e.record.get("created")));
}, "zendesk_tickets");

// Weekly autonomous Toronto collection schedule check (runs every Monday at 22:00 UTC)
cronAdd("toronto_collection_weekly", "0 22 * * 1", () => {
    try {
        const { fetchAndNotifyCollectionSchedule } = require(`${__hooks}/pages/utils/collection.js`);
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
