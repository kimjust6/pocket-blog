const {
    SITE_NAME,
    SITE_DESCRIPTION,
    AUTHOR_NAME,
    AUTHOR_SHORT_NAME,
    getPostTypeConfig,
} = require("./constants.js");
const {
    getBlogPostById,
    getBlogPostsByTitlePrefix,
    getClimbingPostById,
    getClimbingLogsByTitlePrefix,
    getBlogPosts,
    getClimbingLogs,
    getCombinedHomepagePosts,
    getAllBlogPosts,
    getAllClimbingLogs,
    isClimbingRecord,
    getAdjacentPosts,
    getClimbingStats,
} = require("./pocket.js");
const format = require("./format.js");
const analytics = require("./analytics.js");
const seo = require("./seo.js");

const {
    formatDateTime,
    getBaseUrl,
    getImageUrl,
    slugifyTitle,
    getPostUrl,
    getPostDateRaw,
    extractPreviewText,
    getReadingStats,
    toNoCookie,
    extractPostBadges,
    resolvePostImage,
} = format;

const { sanitizeSearchTerm, trackGAEvent } = analytics;
const { setOrUpdateMeta, applySectionMeta, applyStaticPageMetadata, applySinglePostMetadata } = seo;

/**
 * Format a post record into a view-model object for cards (hero & grid).
 * @param {Object} post
 * @param {boolean} isHomepage
 * @param {boolean} isClimbing
 * @returns {Object|null}
 */
function formatPostViewModel(post, isHomepage = false, isClimbing = false) {
    if (!post) return null;
    const itemIsClimbing = isClimbing || isClimbingRecord(post);
    const title = post.getString("title") || "";
    const slug = slugifyTitle(title);
    const rawText = (itemIsClimbing ? post.getString("content") : post.getString("content1")) || "";
    const previewText = extractPreviewText(rawText);
    const { wordCount, readingTime } = getReadingStats(post, itemIsClimbing);

    const heroImageUrl = resolvePostImage(post, itemIsClimbing, "800x0");
    const gridImageUrl = resolvePostImage(post, itemIsClimbing, "350x0");
    const link = getPostUrl(post.id, title, itemIsClimbing);
    const dateRaw = getPostDateRaw(post, itemIsClimbing);
    const formattedDate = formatDateTime(new Date(dateRaw));
    const badges = extractPostBadges(post, itemIsClimbing, false);

    return {
        id: post.id,
        title,
        slug,
        link,
        previewText,
        heroImageUrl,
        gridImageUrl,
        formattedDate,
        readingTime,
        wordCount,
        itemIsClimbing,
        badges,
        location: itemIsClimbing ? post.getString("location") : null,
        rawRecord: post,
    };
}

/**
 * Prepare blog posts view data on the server.
 */
function prepareBlogPostsViewData(blogposts, isHomepage, isClimbing, params = {}, req = null, data = {}) {
    const rawQuery = params?.query || "";
    const query = sanitizeSearchTerm(rawQuery);
    const hasSearchQuery = !isHomepage && !!query;

    const items = (blogposts?.items || []).map((post) => formatPostViewModel(post, isHomepage, isClimbing));

    let heroPost = null;
    let gridPosts = items;
    if (isHomepage && gridPosts.length > 0) {
        heroPost = gridPosts[0];
        gridPosts = gridPosts.slice(1);
    }

    const hasPosts = !!heroPost || gridPosts.length > 0;
    const hasNoSearchResults = hasSearchQuery && !hasPosts;

    let fullParams = hasSearchQuery ? `&query=${encodeURIComponent(query)}` : "";
    if (isClimbing && params?.climbType) {
        fullParams += `&climbType=${encodeURIComponent(params.climbType)}`;
    }

    if (data?.metadata) {
        try {
            if (isClimbing) {
                applySectionMeta(data.metadata, {
                    title: `The Climbing Blog | ${AUTHOR_NAME}`,
                    ogTitle: "The Climbing Blog",
                    description: "A personal record of my falls, projects, and sends (on rock and in the gym).",
                    url: `${getBaseUrl()}/climbing`,
                    siteName: "The Climbing Blog",
                });
            } else if (!isHomepage) {
                applySectionMeta(data.metadata, {
                    title: `The Dev Blog | ${AUTHOR_NAME}`,
                    ogTitle: "The Development Blog",
                    description: SITE_DESCRIPTION,
                    url: `${getBaseUrl()}/blog/posts`,
                    siteName: SITE_NAME,
                });
            }

            if (hasSearchQuery) {
                const searchTitle = `Search: "${query}" | ${isClimbing ? "The Climbing Blog" : SITE_NAME}`;
                setOrUpdateMeta(data.metadata, "title", searchTitle);
                setOrUpdateMeta(data.metadata, "og:title", searchTitle);
                setOrUpdateMeta(data.metadata, "twitter:title", searchTitle);
                setOrUpdateMeta(data.metadata, "robots", "noindex, follow");
            }
        } catch (err) {
            console.error("Error preparing blog posts view metadata: ", err);
        }
    }

    return {
        query,
        hasSearchQuery,
        heroPost,
        gridPosts,
        hasPosts,
        hasNoSearchResults,
        fullParams,
    };
}

/**
 * Prepare single blog view data on the server, including metadata updates and GA view_item tracking.
 */
function prepareBlogSingleViewData(singleBlog, isClimbing, params = {}, data = {}, req = null) {
    if (!singleBlog && (params?.title || params?.id)) {
        try {
            if (params.id) {
                try {
                    singleBlog = isClimbing ? getClimbingPostById(params.id) : getBlogPostById(params.id);
                } catch (_) {
                    singleBlog = null;
                }
            }

            if (!singleBlog && params.title) {
                const titleParam = params.title;
                const firstWord = titleParam.split("-")[0].replace(/"/g, '\\"');
                const possibleBlogs = isClimbing
                    ? getClimbingLogsByTitlePrefix(firstWord)
                    : getBlogPostsByTitlePrefix(firstWord);

                const targetSlug = titleParam.toLowerCase();
                singleBlog =
                    possibleBlogs.find((b) => slugifyTitle(b.getString("title")) === targetSlug) || null;
            }
        } catch (error) {
            console.error("Error fetching single blog post: ", error);
        }
    }

    if (!singleBlog) {
        return null;
    }

    if (data?.metadata) {
        try {
            applySinglePostMetadata(singleBlog, isClimbing, data.metadata);
        } catch (err) {
            console.error("Error preparing single blog view metadata: ", err);
        }
    }

    const postTitle = singleBlog.getString("title") || "";
    trackGAEvent(
        "view_item",
        {
            event_category: isClimbing ? "climbing_engagement" : "blog_engagement",
            item_id: singleBlog.id,
            item_name: postTitle,
            item_category: isClimbing ? singleBlog.getString("climbType") || "" : singleBlog.getString("tags") || "",
            author: AUTHOR_SHORT_NAME,
        },
        req
    );

    const cfg = getPostTypeConfig(isClimbing);
    const imageUrl = resolvePostImage(singleBlog, isClimbing, "1000x0");
    const badges = extractPostBadges(singleBlog, isClimbing, true);

    const dateRaw = getPostDateRaw(singleBlog, isClimbing);
    const formattedDate = formatDateTime(new Date(dateRaw));

    const updatedRaw = singleBlog.getString("updated");
    const formattedUpdated = updatedRaw ? formatDateTime(new Date(updatedRaw)) : null;

    const cleanContent = toNoCookie(singleBlog.getString(isClimbing ? "content" : "content1"));
    const cleanContent2 =
        !isClimbing && singleBlog.getString("content2") ? toNoCookie(singleBlog.getString("content2")) : null;

    const coverImageAlt = singleBlog.getString("coverImageAlt") || postTitle || null;
    const dateIso = dateRaw ? new Date(dateRaw).toISOString() : null;
    const updatedIso = updatedRaw ? new Date(updatedRaw).toISOString() : null;
    const { wordCount, readingTime } = getReadingStats(singleBlog, isClimbing);

    const adjacent = getAdjacentPosts(singleBlog, isClimbing);
    const formatAdjacent = (p) => {
        if (!p) return null;
        const t = p.getString("title") || "";
        return {
            id: p.id,
            title: t,
            slug: slugifyTitle(t),
            link: getPostUrl(p.id, t, isClimbing),
            formattedDate: formatDateTime(new Date(getPostDateRaw(p, isClimbing))),
        };
    };

    return {
        id: singleBlog.id,
        rawBlog: singleBlog,
        title: postTitle,
        imageUrl,
        coverImageAlt,
        badges,
        isClimbing,
        formattedDate,
        formattedUpdated,
        dateIso,
        updatedIso,
        cleanContent,
        cleanContent2,
        readingTime,
        wordCount,
        prevPost: formatAdjacent(adjacent.prev),
        nextPost: formatAdjacent(adjacent.next),
        backLink: cfg.routePrefix,
        backLabel: cfg.backLabel,
        dateLabel: cfg.dateLabel,
    };
}

/**
 * Strip raw PocketBase record from a formatted post card view model for JSON serialization.
 */
function serializePostCard(vm) {
    if (!vm) return null;
    return {
        id: vm.id,
        title: vm.title,
        slug: vm.slug,
        link: vm.link,
        previewText: vm.previewText,
        heroImageUrl: vm.heroImageUrl,
        gridImageUrl: vm.gridImageUrl,
        formattedDate: vm.formattedDate,
        readingTime: vm.readingTime || null,
        wordCount: vm.wordCount || 0,
        itemIsClimbing: vm.itemIsClimbing,
        badges: vm.badges || [],
        location: vm.location || null,
    };
}

/**
 * Build a JSON-serializable view payload for list routes (homepage, dev blog, climbing).
 */
function buildBlogPostsPayload(isHomepage, isClimbing, params = {}, req = null, data = {}) {
    const currentPage = Math.max(1, parseInt(params?.page, 10) || 1);
    const perPage = Math.max(1, parseInt(params?.perPage, 10) || (isHomepage ? 7 : 6));

    const rawBlogPosts = isHomepage
        ? getCombinedHomepagePosts(currentPage, perPage, params?.query) ?? { items: [], totalPages: 1 }
        : isClimbing
            ? getClimbingLogs(currentPage, perPage, params?.query, params?.climbType) ?? { items: [], totalPages: 1 }
            : getBlogPosts(currentPage, perPage, params?.query) ?? { items: [], totalPages: 1 };
    const totalPages = rawBlogPosts?.totalPages || 1;

    const viewData = prepareBlogPostsViewData(rawBlogPosts, isHomepage, isClimbing, params, req, data);
    const pageTitle = isClimbing
        ? `The Climbing Blog | ${AUTHOR_NAME}`
        : isHomepage
            ? SITE_NAME
            : `The Dev Blog | ${AUTHOR_NAME}`;

    const climbingStats = isClimbing ? getClimbingStats() : null;

    return {
        type: "posts-list",
        isHomepage: !!isHomepage,
        isClimbing: !!isClimbing,
        currentPage,
        totalPages,
        query: viewData.query || "",
        rawQuery: params?.query ? String(params.query) : "",
        climbType: params?.climbType ? String(params.climbType) : "",
        hasSearchQuery: viewData.hasSearchQuery,
        hasPosts: viewData.hasPosts,
        hasNoSearchResults: viewData.hasNoSearchResults,
        fullParams: viewData.fullParams,
        pageTitle,
        heroPost: serializePostCard(viewData.heroPost),
        gridPosts: (viewData.gridPosts || []).map(serializePostCard),
        climbingStats,
    };
}

/**
 * Serialize a single post view model into a JSON-safe route payload.
 */
function serializeSinglePostPayload(view, isClimbing) {
    if (!view || !view.rawBlog) {
        return {
            type: "not-found",
            found: false,
            pageTitle: SITE_NAME,
        };
    }

    const postTitle = view.title || "";
    const canonicalPath = getPostUrl(view.id, postTitle, isClimbing);
    const pageTitle = isClimbing ? `${postTitle} | Climbing Blog` : `${postTitle} | ${SITE_NAME}`;

    return {
        type: "post-detail",
        found: true,
        canonicalPath,
        pageTitle,
        post: {
            id: view.id,
            title: view.title,
            imageUrl: view.imageUrl,
            badges: view.badges || [],
            isClimbing: !!view.isClimbing,
            formattedDate: view.formattedDate,
            formattedUpdated: view.formattedUpdated,
            readingTime: view.readingTime || null,
            wordCount: view.wordCount || 0,
            cleanContent: view.cleanContent,
            cleanContent2: view.cleanContent2,
            prevPost: view.prevPost || null,
            nextPost: view.nextPost || null,
            backLink: view.backLink,
            backLabel: view.backLabel,
            dateLabel: view.dateLabel,
        },
    };
}

/**
 * Build a JSON-serializable view payload for a single post or climbing log.
 */
function buildSinglePostPayload(isClimbing, params = {}, req = null, data = {}) {
    const metaCtx = data && data.metadata ? data : Object.assign({}, data || {}, { metadata: [] });
    const view = prepareBlogSingleViewData(null, !!isClimbing, params, metaCtx, req);
    return serializeSinglePostPayload(view, isClimbing);
}

/**
 * Shared route controller for `/blog/posts/[title]/[id]` and `/climbing/[title]/[id]`.
 */
function handleSinglePostRoute(isClimbing, params = {}, data = {}, req = null, api = {}, redirectFn = null) {
    if (!params.id && (params.title === "rss.xml" || params.title === "rss")) {
        if (typeof redirectFn === "function") {
            redirectFn(`/rss.xml?topic=${isClimbing ? "climbing" : "blog"}`, 301);
            return {
                isClimbing: !!isClimbing,
                isListView: false,
                isLegacyPost: true,
                isCanonicalPost: false,
                singleBlogView: null,
            };
        }
    }

    const isListView = !params.id && (!params.title || params.title === "index");
    const isLegacyPost = !params.id && Boolean(params.title) && params.title !== "index";
    const isCanonicalPost = Boolean(params.id);

    let viewForRedirect = null;
    let singleBlogView = null;

    if (isLegacyPost) {
        viewForRedirect = prepareBlogSingleViewData(null, !!isClimbing, params, data, req);
        if (viewForRedirect && viewForRedirect.rawBlog && typeof redirectFn === "function") {
            const rawBlog = viewForRedirect.rawBlog;
            redirectFn(getPostUrl(rawBlog.id, rawBlog.getString("title"), isClimbing), 301);
        }
    } else if (isCanonicalPost) {
        singleBlogView = prepareBlogSingleViewData(null, !!isClimbing, params, data, req);
    }

    if (!isListView && ((isCanonicalPost && singleBlogView == null) || (!isCanonicalPost && !viewForRedirect))) {
        api.status = 404;
        applyStaticPageMetadata(data?.metadata, "notfound");
        data.initialRouteData = serializeSinglePostPayload(null, !!isClimbing);
    } else if (isCanonicalPost && singleBlogView) {
        data.initialRouteData = serializeSinglePostPayload(singleBlogView, !!isClimbing);
    }

    return {
        isClimbing: !!isClimbing,
        isListView,
        isLegacyPost,
        isCanonicalPost,
        singleBlogView,
    };
}

/**
 * Fetch records and base URL for XML sitemap generation.
 */
function getSitemapData() {
    let blogposts = [];
    let climbingposts = [];
    try {
        blogposts = getAllBlogPosts("-updated") || [];
    } catch (err) {
        console.error("Error fetching blog posts for sitemap:", err);
    }
    try {
        climbingposts = getAllClimbingLogs("-date") || [];
    } catch (err) {
        console.error("Error fetching climbing logs for sitemap:", err);
    }
    return {
        blogposts,
        climbingposts,
        baseUrl: getBaseUrl(),
        slugifyTitle,
    };
}

module.exports = Object.assign(
    {},
    format,
    analytics,
    seo,
    {
        prepareBlogPostsViewData,
        prepareBlogSingleViewData,
        handleSinglePostRoute,
        getSitemapData,
        formatPostViewModel,
        serializePostCard,
        serializeSinglePostPayload,
        buildBlogPostsPayload,
        buildSinglePostPayload,
        getAdjacentPosts,
        getClimbingStats,
    }
);
