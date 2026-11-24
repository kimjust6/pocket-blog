const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("../pb_public/js/api.js");

const {
    safeDecodePath,
    setBoundedCache,
    getListCacheKey,
    createListSnapshot,
    createBlogClient,
} = globalThis.BlogApi;

describe("frontend BlogApi", () => {
    it("decodes URI paths safely and builds stable cache keys", () => {
        assert.equal(safeDecodePath("/blog/posts/hello%20world/1"), "/blog/posts/hello world/1");
        assert.equal(safeDecodePath("%E0%A4%A"), "%E0%A4%A");
        assert.equal(
            getListCacheKey("climbing", { page: 2, query: "v5", climbType: "Bouldering" }),
            "section=climbing&page=2&query=v5&climbType=Bouldering"
        );
    });

    it("evicts oldest entries in setBoundedCache", () => {
        const cache = new Map();
        setBoundedCache(cache, "a", 1, 2);
        setBoundedCache(cache, "b", 2, 2);
        setBoundedCache(cache, "c", 3, 2);
        assert.deepEqual(Array.from(cache.keys()), ["b", "c"]);
    });

    it("seeds and consumes initial payload and caches API responses", async () => {
        const initial = {
            type: "posts-list",
            isHomepage: true,
            isClimbing: false,
            currentPage: 1,
            totalPages: 3,
            gridPosts: [],
        };
        let fetchCount = 0;
        const mockFetch = async (url) => {
            fetchCount++;
            if (url.startsWith("/api/posts")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ type: "posts-list", currentPage: 1, totalPages: 2, gridPosts: [{ id: "p1" }] }),
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    found: true,
                    canonicalPath: "/blog/posts/hello/p1",
                    post: { id: "p1", title: "Hello" },
                }),
            };
        };

        const client = createBlogClient(initial, mockFetch);
        client.seedCacheFromInitial({ query: {} });
        assert.equal(client.listCache.size, 1);

        const consumed = client.consumeInitialPayload("posts-list");
        assert.equal(consumed.totalPages, 3);
        assert.equal(client.consumeInitialPayload("posts-list"), null);

        // Fetch blog list twice -> should hit fetch once and cache second time
        const list1 = await client.fetchPostsPayload("blog", { page: 1 });
        const list2 = await client.fetchPostsPayload("blog", { page: 1 });
        assert.equal(list1, list2);
        assert.equal(fetchCount, 1);

        // Prefetch legacy route returns canonical redirect path
        const redirect = await client.prefetchTargetRoute(
            { name: "blog-legacy", path: "/blog/posts/old-slug", fullPath: "/blog/posts/old-slug", params: { title: "old-slug" } },
            { params: {} },
            { aborted: false }
        );
        assert.equal(redirect, "/blog/posts/hello/p1");
        assert.equal(fetchCount, 2);

        // Fetching by id now hits cache
        const cachedPost = await client.fetchSinglePostPayload(false, { id: "p1" });
        assert.equal(cachedPost.found, true);
        assert.equal(fetchCount, 2);

        const snap = createListSnapshot("home", { currentPage: 1, totalPages: 2 });
        assert.equal(snap.hasMore, true);
    });
});
