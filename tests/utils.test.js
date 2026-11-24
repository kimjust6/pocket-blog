const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    slugifyTitle,
    escapeXml,
    escapeCdata,
    sanitizeSearchTerm,
    toNoCookie,
} = require("../pb_hooks/pages/utils/blog.js");
const { buildSearchFilter } = require("../pb_hooks/pages/utils/pocket.js");
const { verifyConfiguredSecret } = require("../pb_hooks/pages/utils/discord.js");
const {
    parseIsoDate,
    formatIsoDate,
    parseCsv,
    buildCollectionEvent,
    formatCollectionDiscordMessage,
} = require("../pb_hooks/pages/utils/collection.js");

describe("blog.js helpers", () => {
    it("slugifyTitle normalizes punctuation and casing", () => {
        assert.equal(slugifyTitle("Hello, World! 2026"), "hello-world-2026");
        assert.equal(slugifyTitle("  --Leading & Trailing--  "), "leading-trailing");
        assert.equal(slugifyTitle(""), "");
        assert.equal(slugifyTitle(null), "");
    });

    it("escapeXml escapes XML special characters", () => {
        assert.equal(
            escapeXml(`<tag attr="a" single='b'>A & B</tag>`),
            "&lt;tag attr=&quot;a&quot; single=&apos;b&apos;&gt;A &amp; B&lt;/tag&gt;"
        );
        assert.equal(escapeXml(null), "");
    });

    it("escapeCdata safely splits CDATA end sequences", () => {
        assert.equal(escapeCdata("hello ]]> world"), "hello ]]]]><![CDATA[> world");
    });

    it("sanitizeSearchTerm strips HTML, drops sensitive patterns, and caps length", () => {
        assert.equal(sanitizeSearchTerm("  <b>pocketbase</b>  "), "pocketbase");
        assert.equal(sanitizeSearchTerm("user@example.com"), "");
        assert.equal(sanitizeSearchTerm("https://evil.test/token"), "");
        assert.equal(sanitizeSearchTerm("my password is 123"), "");
        assert.equal(sanitizeSearchTerm("a".repeat(150)).length, 100);
        assert.equal(sanitizeSearchTerm(null), "");
    });

    it("toNoCookie rewrites YouTube embeds to youtube-nocookie", () => {
        const html = `<iframe src="https://www.youtube.com/embed/abc123"></iframe>`;
        const rewritten = toNoCookie(html);
        assert.ok(rewritten.includes("https://www.youtube-nocookie.com/embed/abc123"));
        assert.ok(!rewritten.includes("https://www.youtube.com/embed/"));
    });
});

describe("pocket.js buildSearchFilter", () => {
    it("returns empty filter for blank query", () => {
        const res = buildSearchFilter(["title", "tags"], "   ");
        assert.equal(res.filterClause, null);
        assert.equal(res.sqlCondition, null);
        assert.deepEqual(res.filterParams, {});
    });

    it("builds matching PocketBase filter and SQL condition for single-word query", () => {
        const res = buildSearchFilter(["title", "tags"], "climbing");
        assert.equal(res.filterClause, "(title ~ {:query} || tags ~ {:query})");
        assert.deepEqual(res.filterParams, { query: "climbing" });
        assert.equal(res.sqlCondition.expr, "(title LIKE {:query} OR tags LIKE {:query})");
        assert.deepEqual(res.sqlCondition.params, { query: "%climbing%" });
    });

    it("builds matching AND-combined clauses for multi-word query", () => {
        const res = buildSearchFilter(["title", "grade"], "v5 boulder");
        assert.equal(
            res.filterClause,
            "((title ~ {:qw_0} || grade ~ {:qw_0}) && (title ~ {:qw_1} || grade ~ {:qw_1}))"
        );
        assert.deepEqual(res.filterParams, { qw_0: "v5", qw_1: "boulder" });
        assert.equal(
            res.sqlCondition.expr,
            "((title LIKE {:qw_0} OR grade LIKE {:qw_0}) AND (title LIKE {:qw_1} OR grade LIKE {:qw_1}))"
        );
        assert.deepEqual(res.sqlCondition.params, { qw_0: "%v5%", qw_1: "%boulder%" });
    });
});

describe("collection.js helpers", () => {
    it("parseIsoDate and formatIsoDate round-trip UTC dates", () => {
        const d = parseIsoDate("2026-11-23");
        assert.equal(formatIsoDate(d), "2026-11-23");
    });

    it("parseCsv parses headered CSV rows", () => {
        const rows = parseCsv("Calendar,WeekStarting,GreenBin\nTuesday1,2026-11-22,T\n");
        assert.equal(rows.length, 1);
        assert.deepEqual(rows[0], {
            Calendar: "Tuesday1",
            WeekStarting: "2026-11-22",
            GreenBin: "T",
        });
    });

    it("buildCollectionEvent returns null for '0' and builds event for valid day code", () => {
        const weekStarting = parseIsoDate("2026-11-22");
        assert.equal(buildCollectionEvent(weekStarting, "GreenBin", "0"), null);
        const evt = buildCollectionEvent(weekStarting, "GreenBin", "T");
        assert.deepEqual(evt, {
            collectionType: "GreenBin",
            title: "Green Bin",
            start: "2026-11-24",
            end: "2026-11-24",
            url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-green-bin/",
        });
    });

    it("formatCollectionDiscordMessage uses Garbage or Recycle title based on week items", () => {
        const garbageMsg = formatCollectionDiscordMessage({
            json: {
                address: "123 Main St",
                collectionCalendar: [
                    { collectionType: "GreenBin", title: "Green Bin", start: "2026-11-24" },
                    { collectionType: "Garbage", title: "Garbage", start: "2026-11-24" },
                ],
            },
        });
        assert.ok(garbageMsg.startsWith("**Garbage Collection Schedule**"));

        const recycleMsg = formatCollectionDiscordMessage({
            json: {
                address: "123 Main St",
                collectionCalendar: [
                    { collectionType: "GreenBin", title: "Green Bin", start: "2026-12-01" },
                    { collectionType: "Recycling", title: "Recycling", start: "2026-12-01" },
                ],
            },
        });
        assert.ok(recycleMsg.startsWith("**Recycle Collection Schedule**"));
    });
});

describe("discord.js verifyConfiguredSecret", () => {
    it("fails closed when no secret is configured", () => {
        const res = verifyConfiguredSecret(
            { requestInfo: () => ({ headers: {}, query: {} }) },
            "NONEXISTENT_TEST_SECRET_ENV",
            null
        );
        assert.deepEqual(res, { configured: false, authorized: false });
    });

    it("authorizes via configured header and rejects query string secrets", () => {
        process.env.TEST_WEBHOOK_SECRET = "s3cr3t-value";
        try {
            const ok = verifyConfiguredSecret(
                { requestInfo: () => ({ headers: { "x-webhook-secret": "s3cr3t-value" }, query: {} }) },
                "TEST_WEBHOOK_SECRET",
                null
            );
            assert.deepEqual(ok, { configured: true, authorized: true });

            const queryAttempt = verifyConfiguredSecret(
                { requestInfo: () => ({ headers: {}, query: { token: "s3cr3t-value", secret: "s3cr3t-value" } }) },
                "TEST_WEBHOOK_SECRET",
                null
            );
            assert.deepEqual(queryAttempt, { configured: true, authorized: false });
        } finally {
            delete process.env.TEST_WEBHOOK_SECRET;
        }
    });
});
