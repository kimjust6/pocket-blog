const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    getReadingStats,
    extractPostBadges,
    resolvePostImage,
} = require("../pb_hooks/pages/utils/format.js");
const {
    formatPostViewModel,
    serializePostCard,
    prepareBlogPostsViewData,
} = require("../pb_hooks/pages/utils/blog.js");
const { applySinglePostMetadata } = require("../pb_hooks/pages/utils/seo.js");

function makeRecord(id, fields, collectionName = "blog_posts") {
    return {
        id,
        collectionName,
        collectionId: "col_1",
        getString(key) {
            return fields[key] != null ? String(fields[key]) : "";
        },
    };
}

describe("blog format & view-model helpers", () => {
    it("computes reading stats across blog content1/content2 and climbing content", () => {
        const words250 = Array(250).fill("word").join(" ");
        const blogRec = makeRecord("b1", { content1: `<p>${words250}</p>`, content2: `<p>${words250}</p>` });
        const stats = getReadingStats(blogRec, false);
        assert.equal(stats.wordCount, 500);
        assert.equal(stats.readingTime, "3 min read");

        const emptyClimb = makeRecord("c1", { content: "" }, "climbing_posts");
        assert.equal(getReadingStats(emptyClimb, true).readingTime, "1 min read");
    });

    it("extracts badges for blog tags and climbing attributes", () => {
        const blogRec = makeRecord("b1", { tags: "JS ; PocketBase ; " });
        assert.deepEqual(extractPostBadges(blogRec, false), [
            { text: "JS", query: "JS" },
            { text: "PocketBase", query: "PocketBase" },
        ]);

        const climbRec = makeRecord(
            "c1",
            { climbType: "Bouldering", grade: "V5", style: "Send", location: "Joe Rockhead" },
            "climbing_posts"
        );
        assert.deepEqual(extractPostBadges(climbRec, true, true), [
            { text: "Bouldering", query: "Bouldering" },
            { text: "V5", query: "V5" },
            { text: "Send", query: "Send" },
            { text: "Joe Rockhead", query: "Joe Rockhead", isLocation: true },
        ]);
    });

    it("resolves post images with thumb spec or fallbacks", () => {
        const withCover = makeRecord("b1", { coverImage: "hero.webp" });
        assert.match(resolvePostImage(withCover, false, "350x0"), /\/api\/files\/col_1\/b1\/hero\.webp\?thumb=350x0$/);

        const climbNoCover = makeRecord("c1", {}, "climbing_posts");
        assert.equal(resolvePostImage(climbNoCover, true, "800x0"), "/background.webp");
    });

    it("formats view models, strips rawRecord on serializePostCard, and splits homepage hero/grid", () => {
        const p1 = makeRecord("id1", { title: "First Post", content1: "<p>Alpha</p>", manualPublishDate: "2026-11-01 10:00:00" });
        const p2 = makeRecord("id2", { title: "Second Post", content1: "<p>Beta</p>", manualPublishDate: "2026-10-01 10:00:00" });

        const vm = formatPostViewModel(p1, true, false);
        assert.ok(vm.rawRecord);
        const card = serializePostCard(vm);
        assert.equal(card.rawRecord, undefined);
        assert.equal(card.link, "/blog/posts/first-post/id1");

        const metadata = [];
        const homeView = prepareBlogPostsViewData({ items: [p1, p2] }, true, false, {}, null, { metadata });
        assert.equal(homeView.heroPost.id, "id1");
        assert.equal(homeView.gridPosts.length, 1);
        assert.equal(homeView.gridPosts[0].id, "id2");

        const searchMeta = [];
        const emptySearch = prepareBlogPostsViewData({ items: [] }, false, true, { query: "v10" }, null, { metadata: searchMeta });
        assert.equal(emptySearch.hasNoSearchResults, true);
        assert.equal(searchMeta.find((m) => m.name === "robots")?.content, "noindex, follow");
    });

    it("applies single post metadata cleanly without duplicate article:tag entries", () => {
        const longText = Array(40).fill("climbing").join(" ");
        const rec = makeRecord(
            "c9",
            {
                title: "Outdoor Send",
                content: `<p>${longText}</p>`,
                climbType: "Sport",
                grade: "5.11a",
                date: "2026-11-20T12:00:00Z",
                updated: "2026-11-21T12:00:00Z",
            },
            "climbing_posts"
        );
        const metadata = [{ name: "article:tag", content: "stale-tag" }];
        applySinglePostMetadata(rec, true, metadata);

        const tags = metadata.filter((m) => m.name === "article:tag").map((m) => m.content);
        assert.deepEqual(tags, ["Sport", "5.11a"]);
        const desc = metadata.find((m) => m.name === "description")?.content;
        assert.ok(desc.length <= 158 && desc.endsWith("..."));
    });
});
