const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    formatDateTime,
    slugifyTitle,
    getPostUrl,
    escapeXml,
    escapeCdata,
    extractPreviewText,
    toNoCookie,
} = require("../pb_hooks/pages/utils/format.js");
const { sanitizeSearchTerm } = require("../pb_hooks/pages/utils/analytics.js");
const { applyStaticPageMetadata, buildJsonLdGraph } = require("../pb_hooks/pages/utils/seo.js");
const { constantTimeEqual, decodeHttpBody, getHttpJson } = require("../pb_hooks/pages/utils/http.js");
const { parseCsv, buildCollectionScheduleResponse } = require("../pb_hooks/pages/utils/collection.js");
const { privateGetBody, getTicketId, isTicketClosed, isSlaBreaching } = require("../pb_hooks/pages/utils/zendesk.js");
const { getConfigValue, buildSearchFilter } = require("../pb_hooks/pages/utils/pocket.js");

describe("format helpers", () => {
    it("formats valid dates and returns empty string for invalid dates", () => {
        assert.equal(formatDateTime(new Date(2026, 0, 5)), "Jan 05, 2026");
        assert.equal(formatDateTime(new Date("not-a-date")), "");
    });

    it("slugifies titles and builds canonical post URLs", () => {
        assert.equal(slugifyTitle("Hello, World! 2026"), "hello-world-2026");
        assert.equal(getPostUrl("abc123", "Hello, World!", false), "/blog/posts/hello-world/abc123");
        assert.equal(getPostUrl("xyz789", "V5 Project", true), "/climbing/v5-project/xyz789");
    });

    it("escapes XML and CDATA safely", () => {
        assert.equal(escapeXml(`<a href="x&y">'test'</a>`), "&lt;a href=&quot;x&amp;y&quot;&gt;&apos;test&apos;&lt;/a&gt;");
        assert.equal(escapeCdata("foo]]>bar"), "foo]]]]><![CDATA[>bar");
    });

    it("extracts preview text without leading headings or HTML tags", () => {
        const html = "<h2>Intro</h2><p><strong>Note:</strong> Hello &amp; welcome&nbsp;world.</p>";
        assert.equal(extractPreviewText(html), "Hello & welcome world.");
    });

    it("rewrites YouTube iframes to youtube-nocookie with responsive styles", () => {
        const out = toNoCookie('<iframe width="560" height="315" src="https://www.youtube.com/embed/abc"></iframe>');
        assert.match(out, /https:\/\/www\.youtube-nocookie\.com\/embed\/abc/);
        assert.match(out, /aspect-ratio: 560 \/ 315/);
        assert.match(out, /loading="lazy"/);
    });
});

describe("analytics & privacy helpers", () => {
    it("sanitizes search terms and drops sensitive inputs", () => {
        assert.equal(sanitizeSearchTerm("<b>bouldering</b> v4"), "bouldering v4");
        assert.equal(sanitizeSearchTerm("user@example.com"), "");
        assert.equal(sanitizeSearchTerm("https://evil.test/token"), "");
        assert.equal(sanitizeSearchTerm("my password here"), "");
    });
});

describe("seo helpers", () => {
    it("applies static page metadata and robots noindex on notfound", () => {
        const meta = [];
        applyStaticPageMetadata(meta, "faq");
        assert.ok(meta.some((m) => m.name === "title" && m.content.includes("Frequently Asked Questions")));

        const nfMeta = [];
        applyStaticPageMetadata(nfMeta, "notfound");
        assert.equal(nfMeta.find((m) => m.name === "robots")?.content, "noindex, nofollow");
    });

    it("builds JSON-LD graph with WebSite, Person, BreadcrumbList, and BlogPosting", () => {
        const graph = buildJsonLdGraph({
            baseUrl: "https://myblog.jkim.win",
            currentPath: "/climbing/v5-send/123",
            siteName: "The Justin Blog",
            siteDescription: "Notes",
            authorName: "Justin Kim",
            authorUrl: "https://www.jkim.win",
            socials: [{ url: "https://github.com/kimjust6" }],
            metadata: [
                { name: "og:type", content: "article" },
                { name: "og:title", content: "V5 Send" },
                { name: "og:url", content: "https://myblog.jkim.win/climbing/v5-send/123" },
                { name: "article:word_count", content: "400" },
            ],
        });
        assert.equal(graph["@context"], "https://schema.org");
        const types = graph["@graph"].map((n) => n["@type"]);
        assert.deepEqual(types, ["WebSite", "Person", "BreadcrumbList", "BlogPosting"]);
        assert.equal(graph["@graph"][3].wordCount, 400);
    });
});

describe("http & config helpers", () => {
    it("compares strings in constant time", () => {
        assert.equal(constantTimeEqual("secret123", "secret123"), true);
        assert.equal(constantTimeEqual("secret123", "secret124"), false);
        assert.equal(constantTimeEqual("short", "longer"), false);
    });

    it("decodes byte arrays and parses HTTP JSON", () => {
        const bytes = Array.from(Buffer.from('{"ok":true}', "utf8"));
        assert.equal(decodeHttpBody(bytes), '{"ok":true}');
        assert.deepEqual(getHttpJson({ body: bytes }), { ok: true });
    });

    it("reads config values from process.env", () => {
        process.env.TEST_POCKET_BLOG_CFG = "  hello-cfg  ";
        assert.equal(getConfigValue("TEST_POCKET_BLOG_CFG", ""), "hello-cfg");
        delete process.env.TEST_POCKET_BLOG_CFG;
    });

    it("builds matching PocketBase and SQL search filters", () => {
        const filter = buildSearchFilter(["title", "tags"], "pocketbase vue");
        assert.equal(filter.filterClause, "((title ~ {:qw_0} || tags ~ {:qw_0}) && (title ~ {:qw_1} || tags ~ {:qw_1}))");
        assert.deepEqual(filter.filterParams, { qw_0: "pocketbase", qw_1: "vue" });
    });
});

describe("collection & zendesk helpers", () => {
    it("parses CSV and builds collection schedule response", () => {
        const rows = parseCsv("Calendar,WeekStarting,GreenBin,Garbage,Recycling\nTuesday1,2026-11-22,T,T,0\n");
        assert.equal(rows.length, 1);
        assert.equal(rows[0].Calendar, "Tuesday1");

        const schedule = buildCollectionScheduleResponse(
            {
                json: {
                    result: {
                        rows: [
                            {
                                ADDRESS_FULL: "100 QUEEN ST W",
                                WARD: "10",
                                POSTAL_CODE: "M5H 2N2",
                                LATITUDE: 43.65,
                                LONGITUDE: -79.38,
                                AREACURSOR1: {
                                    array: [{ AREA_NAME: "Tuesday 1", AREA_DESC: "Tuesday", AREA_SHORT_CODE: "T1", AREA_TYPE: "RESW" }],
                                },
                            },
                        ],
                    },
                },
            },
            { json: { Tuesday1: "https://example.com/t1.pdf" } },
            { body: "Calendar,WeekStarting,GreenBin,Garbage,Recycling\nTuesday1,2026-11-22,T,T,0\n" }
        );
        assert.equal(schedule.collectionArea.name, "Tuesday1");
        assert.equal(schedule.pdfUrl, "https://example.com/t1.pdf");
        assert.equal(schedule.nextPickup.length, 2);
    });

    it("unwraps Zendesk payloads and detects status/SLA", () => {
        const payload = {
            body: {
                type: "zen:event-type:ticket.status_changed",
                detail: { id: "42", status: "CLOSED" },
                event: { tags_added: ["nearing_sla_breach_notified"] },
            },
        };
        assert.equal(privateGetBody(payload).type, "zen:event-type:ticket.status_changed");
        assert.equal(getTicketId(payload), 42);
        assert.equal(isTicketClosed(payload), true);
        assert.equal(isSlaBreaching(payload), true);
    });
});
