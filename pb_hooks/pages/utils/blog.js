const {
    GA_MEASUREMENT_ID,
    SITE_NAME,
    SITE_DESCRIPTION,
    DEFAULT_BASE_URL,
    AUTHOR_NAME,
    AUTHOR_SHORT_NAME,
    AUTHOR_URL,
    TWITTER_HANDLE,
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
} = require("./pocket.js");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateTime(date) {
    const month = MONTHS[date.getMonth()];
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

function getBaseUrl() {
    try {
        if (typeof $app !== "undefined" && $app?.settings) {
            const meta = $app.settings()?.meta;
            const appUrl = meta?.appURL || meta?.appUrl;
            if (appUrl) {
                return appUrl.replace(/\/+$/, "");
            }
        }
    } catch (err) {
        if (typeof $app !== "undefined" && $app?.logger) {
            $app.logger().error("Error getting appURL from settings", "error", err);
        }
    }
    return DEFAULT_BASE_URL;
}

/**
 * Build the PocketBase file URL for a record's cover image, or `null`.
 * @param {Object} blog
 * @returns {string|null}
 */
function getImageUrl(blog) {
    if (!blog) return null;

    if (typeof blog.getString === "function") {
        const coverImage = blog.getString("coverImage");
        const collectionId = blog.collectionId || blog.getString("collectionId") || blog.collection?.()?.id;
        const id = blog.id;

        if (coverImage && collectionId && id) {
            return `${getBaseUrl()}/api/files/${collectionId}/${id}/${coverImage}`;
        }
        return null;
    }

    if (blog.coverImage && blog.collectionId && blog.id) {
        return `${getBaseUrl()}/api/files/${blog.collectionId}/${blog.id}/${blog.coverImage}`;
    }
    return null;
}

/**
 * Convert a post title to a URL-safe slug.
 * @param {string} title
 * @returns {string}
 */
function slugifyTitle(title) {
    if (!title) return "";
    return title
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

/**
 * Escape special XML characters for safe embedding outside CDATA.
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Safely embed arbitrary text/HTML inside an XML CDATA section by splitting `]]>`.
 * @param {string} value
 * @returns {string}
 */
function escapeCdata(value) {
    return String(value ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>");
}

/**
 * Sanitize search terms to prevent tracking sensitive data, credentials, URLs, or malicious payloads.
 * @param {string} term
 * @returns {string}
 */
function sanitizeSearchTerm(term) {
    if (!term || typeof term !== "string") return "";
    const clean = term.trim().replace(/<[^>]*>/g, "");
    if (/@|\b(https?|ftp|file):\/\/|password|token|secret/i.test(clean)) {
        return "";
    }
    return clean.slice(0, 100);
}

/**
 * Send an event to Google Analytics 4 Measurement Protocol from the server.
 * @param {string} eventName
 * @param {Object} eventParams
 * @param {Object|null} req
 */
function trackGAEvent(eventName, eventParams = {}, req = null) {
    try {
        const measurementId = GA_MEASUREMENT_ID || "G-6P8M4DJNQL";

        let clientId = "pb_server_client";
        if (req) {
            try {
                let cookies = null;
                if (typeof req.cookies === "function") {
                    cookies = req.cookies();
                } else if (req.cookies) {
                    cookies = req.cookies;
                }
                if (cookies && cookies._ga) {
                    const gaVal = cookies._ga.value || cookies._ga;
                    const parts = String(gaVal).split(".");
                    if (parts.length >= 4) {
                        clientId = parts.slice(2).join(".");
                    }
                }
            } catch (_) {}
        }

        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}`;
        const payload = {
            client_id: clientId,
            events: [
                {
                    name: eventName,
                    params: Object.assign({}, eventParams, {
                        anonymize_ip: true,
                        allow_google_signals: false,
                    }),
                },
            ],
        };

        const sendRequest = () => {
            try {
                if (typeof $http !== "undefined" && $http.send) {
                    $http.send({
                        url,
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });
                }
            } catch (err) {
                if (typeof $app !== "undefined" && $app.logger) {
                    $app.logger().error("Failed to send GA event from backend", "error", err);
                }
            }
        };

        if (typeof setTimeout === "function") {
            setTimeout(sendRequest, 0);
        } else {
            sendRequest();
        }
    } catch (err) {
        if (typeof $app !== "undefined" && $app.logger) {
            $app.logger().error("Failed to prepare GA event tracking", "error", err);
        }
    }
}

/**
 * Rewrite YouTube embeds to youtube-nocookie with responsive aspect-ratio styles.
 * @param {string} s
 * @returns {string}
 */
function toNoCookie(s) {
    if (!s || typeof s !== "string") return "";
    return s
        .replace(/https?:\/\/(www\.)?youtube\.com\/embed\//g, "https://www.youtube-nocookie.com/embed/")
        .replace(/<iframe([^>]*?)>/gi, (match, attrs) => {
            const isYT = /youtube(-nocookie)?\.com\/embed\//.test(match);
            if (!isYT) return match;

            let cleanAttrs = attrs.replace(/\s+sandbox="[^"]*"/gi, "");

            const wMatch = cleanAttrs.match(/\bwidth=["']?(\d+)/i);
            const hMatch = cleanAttrs.match(/\bheight=["']?(\d+)/i);
            const width = wMatch ? parseInt(wMatch[1], 10) : null;
            const height = hMatch ? parseInt(hMatch[1], 10) : null;

            let isVertical = false;
            let aspectRatio = "16 / 9";
            if (width && height && height > width) {
                isVertical = true;
                aspectRatio = `${width} / ${height}`;
            } else if (width && height) {
                aspectRatio = `${width} / ${height}`;
            }

            if (!/\btitle=/i.test(cleanAttrs)) {
                cleanAttrs = ' title="YouTube video player"' + cleanAttrs;
            }
            if (!/\ballow=/i.test(cleanAttrs)) {
                cleanAttrs +=
                    ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"';
            }
            if (!/\ballowfullscreen\b/i.test(cleanAttrs)) {
                cleanAttrs += " allowfullscreen";
            }
            if (!/\bloading=/i.test(cleanAttrs)) {
                cleanAttrs += ' loading="lazy"';
            }

            const styleMatch = cleanAttrs.match(/\bstyle=["']([^"']*)["']/i);
            let styleContent = styleMatch ? styleMatch[1].trim() : "";
            if (styleContent && !styleContent.endsWith(";")) styleContent += ";";

            styleContent = styleContent
                .replace(/(?:^|;)\s*display:[^;]+;?/gi, ";")
                .replace(/(?:^|;)\s*margin-left:[^;]+;?/gi, ";")
                .replace(/(?:^|;)\s*margin-right:[^;]+;?/gi, ";")
                .replace(/(?:^|;)\s*max-width:[^;]+;?/gi, ";")
                .replace(/(?:^|;)\s*width:[^;]+;?/gi, ";")
                .replace(/(?:^|;)\s*height:[^;]+;?/gi, ";")
                .replace(/(?:^|;)\s*aspect-ratio:[^;]+;?/gi, ";")
                .replace(/;+/g, ";")
                .trim();
            if (styleContent.startsWith(";")) styleContent = styleContent.slice(1).trim();

            const maxWidthVal = isVertical ? `min(100%, ${width || 400}px)` : "100%";
            const responsiveStyles = `max-width: ${maxWidthVal}; width: 100%; height: auto; aspect-ratio: ${aspectRatio}; display: block; margin-left: auto; margin-right: auto;`;
            const finalStyle = styleContent ? `${styleContent} ${responsiveStyles}` : responsiveStyles;

            if (styleMatch) {
                cleanAttrs = cleanAttrs.replace(/\bstyle=["'][^"']*["']/i, `style="${finalStyle}"`);
            } else {
                cleanAttrs += ` style="${finalStyle}"`;
            }

            return `<iframe${cleanAttrs}>`;
        });
}

/**
 * Extract structured tag/attribute badges from a blog post or climbing log record.
 * @param {Record} record
 * @param {boolean} itemIsClimbing
 * @param {boolean} includeLocation
 * @returns {Array<{text: string, query: string, isLocation?: boolean}>}
 */
function extractPostBadges(record, itemIsClimbing, includeLocation = false) {
    const badges = [];
    if (itemIsClimbing) {
        ["climbType", "grade", "style"].forEach((field) => {
            const val = record.getString(field);
            if (val && val.trim()) {
                badges.push({ text: val, query: val.trim() });
            }
        });
        if (includeLocation) {
            const location = record.getString("location");
            if (location && location.trim()) {
                badges.push({ text: location, query: location.trim(), isLocation: true });
            }
        }
    } else {
        const blogTags = record.getString("tags");
        if (blogTags && blogTags.length > 0) {
            blogTags.split(";").forEach((tag) => {
                const t = tag.trim();
                if (t) badges.push({ text: t, query: t });
            });
        }
    }
    return badges;
}

/**
 * Resolve a thumbnail or full-size image URL for a post record.
 * @param {Record} record
 * @param {boolean} itemIsClimbing
 * @param {string} thumbSpec
 * @returns {string|null}
 */
function resolvePostImage(record, itemIsClimbing, thumbSpec) {
    const rawImg = getImageUrl(record);
    if (rawImg) {
        return `${rawImg}?thumb=${thumbSpec}`;
    }
    return itemIsClimbing ? "/background.webp" : record.getString("coverImageAlt") || null;
}

/**
 * Format a post record into a view-model object for cards (hero & grid).
 */
function formatPostViewModel(post, isHomepage = false, isClimbing = false) {
    if (!post) return null;
    const itemIsClimbing = isClimbing || isClimbingRecord(post);
    const title = post.getString("title") || "";
    const slug = slugifyTitle(title);
    const rawText = (itemIsClimbing ? post.getString("content") : post.getString("content1")) || "";
    const previewText = extractPreviewText(rawText);

    const heroImageUrl = resolvePostImage(post, itemIsClimbing, "800x0");
    const gridImageUrl = resolvePostImage(post, itemIsClimbing, "350x0");

    const postId = post.id;
    const link = itemIsClimbing
        ? `/climbing/${encodeURIComponent(slug)}/${postId}`
        : `/blog/posts/${encodeURIComponent(slug)}/${postId}`;

    const dateRaw = itemIsClimbing
        ? post.getString("date") || post.getString("created")
        : post.getString("manualPublishDate") || post.getString("created");
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
        itemIsClimbing,
        badges,
        location: itemIsClimbing ? post.getString("location") : null,
        rawRecord: post,
    };
}

/**
 * Update an existing metadata entry or append a new one.
 */
function setOrUpdateMeta(metadata, name, content) {
    if (!metadata || !Array.isArray(metadata) || content === undefined || content === null) return;
    const existing = metadata.find((m) => m.name === name);
    if (existing) {
        existing.content = String(content);
    } else {
        metadata.push({ name, content: String(content) });
    }
}

/**
 * Apply shared list-section Open Graph / Twitter / document metadata.
 */
function applySectionMeta(metadata, { title, ogTitle, description, url, siteName }) {
    const ogImg = `${getBaseUrl()}/og-image.png`;
    setOrUpdateMeta(metadata, "title", title);
    setOrUpdateMeta(metadata, "og:title", ogTitle);
    setOrUpdateMeta(metadata, "twitter:title", ogTitle);
    setOrUpdateMeta(metadata, "description", description);
    setOrUpdateMeta(metadata, "og:description", description);
    setOrUpdateMeta(metadata, "twitter:description", description);
    setOrUpdateMeta(metadata, "url", url);
    setOrUpdateMeta(metadata, "og:url", url);
    setOrUpdateMeta(metadata, "twitter:url", url);
    setOrUpdateMeta(metadata, "og:image", ogImg);
    setOrUpdateMeta(metadata, "twitter:image", ogImg);
    setOrUpdateMeta(metadata, "og:site_name", siteName);
    setOrUpdateMeta(metadata, "og:type", "website");
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
 * Populate metadata and analytics for a resolved single post or climbing log.
 */
function applySinglePostMetadata(singleBlog, isClimbing, metadata, req) {
    const postTitle = singleBlog.getString("title") || "";
    const slug = slugifyTitle(postTitle);
    const baseUrl = getBaseUrl();
    const canonicalPath = isClimbing
        ? `/climbing/${encodeURIComponent(slug)}/${singleBlog.id}`
        : `/blog/posts/${encodeURIComponent(slug)}/${singleBlog.id}`;
    const canonicalUrl = `${baseUrl}${canonicalPath}`;

    const pageTitle = isClimbing ? `${postTitle} | Climbing Blog` : `${postTitle} | ${SITE_NAME}`;
    setOrUpdateMeta(metadata, "title", pageTitle);
    setOrUpdateMeta(metadata, "og:title", postTitle);
    setOrUpdateMeta(metadata, "twitter:title", postTitle);

    const rawContent = singleBlog.getString(isClimbing ? "content" : "content1") || "";
    const metaDescription =
        extractPreviewText(rawContent).slice(0, 160) ||
        (isClimbing ? `Climbing journal log by ${AUTHOR_NAME}.` : `Blog post by ${AUTHOR_NAME}.`);

    setOrUpdateMeta(metadata, "description", metaDescription);
    setOrUpdateMeta(metadata, "og:description", metaDescription);
    setOrUpdateMeta(metadata, "twitter:description", metaDescription);

    setOrUpdateMeta(metadata, "url", canonicalUrl);
    setOrUpdateMeta(metadata, "og:url", canonicalUrl);
    setOrUpdateMeta(metadata, "twitter:url", canonicalUrl);

    setOrUpdateMeta(metadata, "og:type", "article");
    setOrUpdateMeta(metadata, "og:site_name", isClimbing ? "The Climbing Blog" : SITE_NAME);
    setOrUpdateMeta(metadata, "og:locale", "en_CA");

    const rawImgUrl = getImageUrl(singleBlog);
    const ogImageUrl = rawImgUrl ? `${rawImgUrl}?thumb=1200x630` : `${baseUrl}/og-image.png`;
    const coverAlt = singleBlog.getString("coverImageAlt") || postTitle || "Blog post cover image";
    const mimeType = ogImageUrl.includes(".webp")
        ? "image/webp"
        : ogImageUrl.includes(".jpg") || ogImageUrl.includes(".jpeg")
          ? "image/jpeg"
          : "image/png";

    setOrUpdateMeta(metadata, "og:image", ogImageUrl);
    setOrUpdateMeta(metadata, "og:image:secure_url", ogImageUrl);
    setOrUpdateMeta(metadata, "og:image:type", mimeType);
    setOrUpdateMeta(metadata, "twitter:image", ogImageUrl);
    setOrUpdateMeta(metadata, "og:image:alt", coverAlt);
    setOrUpdateMeta(metadata, "og:image:width", "1200");
    setOrUpdateMeta(metadata, "og:image:height", "630");

    setOrUpdateMeta(metadata, "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    setOrUpdateMeta(metadata, "twitter:card", "summary_large_image");
    setOrUpdateMeta(metadata, "twitter:site", TWITTER_HANDLE);
    setOrUpdateMeta(metadata, "twitter:creator", TWITTER_HANDLE);

    setOrUpdateMeta(metadata, "author", AUTHOR_NAME);
    setOrUpdateMeta(metadata, "article:author", AUTHOR_URL);
    setOrUpdateMeta(metadata, "article:author:name", AUTHOR_NAME);
    setOrUpdateMeta(metadata, "article:publisher", `${AUTHOR_URL}/`);
    setOrUpdateMeta(metadata, "article:section", isClimbing ? "Climbing" : "Software Development");

    const publishedDate = isClimbing
        ? singleBlog.getString("date") || singleBlog.getString("created")
        : singleBlog.getString("manualPublishDate") || singleBlog.getString("created");
    if (publishedDate) {
        setOrUpdateMeta(metadata, "article:published_time", new Date(publishedDate).toISOString());
    }

    const updatedDate = singleBlog.getString("updated");
    if (updatedDate) {
        setOrUpdateMeta(metadata, "article:modified_time", new Date(updatedDate).toISOString());
    }

    for (let i = metadata.length - 1; i >= 0; i--) {
        if (metadata[i].name === "article:tag") {
            metadata.splice(i, 1);
        }
    }

    let tagsList = [];
    if (isClimbing) {
        tagsList = ["climbType", "grade", "style", "location"]
            .map((f) => singleBlog.getString(f))
            .filter(Boolean);
    } else {
        const blogTags = singleBlog.getString("tags");
        if (blogTags && blogTags.length > 0) {
            tagsList = blogTags
                .split(";")
                .map((t) => t.trim())
                .filter(Boolean);
        }
    }

    tagsList.forEach((tag) => {
        metadata.push({ name: "article:tag", content: tag });
    });
    if (tagsList.length > 0) {
        setOrUpdateMeta(metadata, "keywords", tagsList.join(", "));
    }

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
            applySinglePostMetadata(singleBlog, isClimbing, data.metadata, req);
        } catch (err) {
            console.error("Error preparing single blog view metadata: ", err);
        }
    }

    const imageUrl = resolvePostImage(singleBlog, isClimbing, "1000x0");
    const badges = extractPostBadges(singleBlog, isClimbing, true);

    const dateRaw = isClimbing
        ? singleBlog.getString("date") || singleBlog.getString("created")
        : singleBlog.getString("manualPublishDate") || singleBlog.getString("created");
    const formattedDate = formatDateTime(new Date(dateRaw));

    const updatedRaw = singleBlog.getString("updated");
    const formattedUpdated = updatedRaw ? formatDateTime(new Date(updatedRaw)) : null;

    const cleanContent = toNoCookie(isClimbing ? singleBlog.getString("content") : singleBlog.getString("content1"));
    const cleanContent2 =
        !isClimbing && singleBlog.getString("content2") ? toNoCookie(singleBlog.getString("content2")) : null;

    return {
        id: singleBlog.id,
        rawBlog: singleBlog,
        title: singleBlog.getString("title"),
        imageUrl,
        badges,
        isClimbing,
        formattedDate,
        formattedUpdated,
        cleanContent,
        cleanContent2,
        backLink: isClimbing ? "/climbing" : "/blog/posts",
        backLabel: isClimbing ? "More Climbing" : "More Dev Posts",
        dateLabel: isClimbing ? "Logged" : "Posted",
    };
}

/**
 * Clean HTML for card previews and meta descriptions.
 * @param {string} html
 * @returns {string}
 */
function extractPreviewText(html) {
    if (!html || typeof html !== "string") return "";

    let clean = html;
    let prev = "";
    while (clean !== prev) {
        prev = clean;
        clean = clean.replace(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
        clean = clean.replace(
            /^\s*(?:<p[^>]*>\s*)?(?:<strong[^>]*>[\s\S]*?<\/strong>|<b[^>]*>[\s\S]*?<\/b>)\s*:?\s*/gi,
            ""
        );
    }

    clean = clean.replace(/<[^>]*>/g, "");

    clean = clean
        .replace(/&nbsp;/gi, " ")
        .replace(/&#160;/g, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&[a-z0-9#]+;/gi, " ");

    return clean.replace(/\s+/g, " ").trim();
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
    const slug = slugifyTitle(postTitle);
    const canonicalPath = isClimbing
        ? `/climbing/${encodeURIComponent(slug)}/${view.id}`
        : `/blog/posts/${encodeURIComponent(slug)}/${view.id}`;
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
            cleanContent: view.cleanContent,
            cleanContent2: view.cleanContent2,
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
    const isListView = !params.id && (!params.title || params.title === "index");
    const isLegacyPost = !params.id && Boolean(params.title) && params.title !== "index";
    const isCanonicalPost = Boolean(params.id);

    let viewForRedirect = null;
    let singleBlogView = null;

    if (isLegacyPost) {
        viewForRedirect = prepareBlogSingleViewData(null, !!isClimbing, params, data, req);
        if (viewForRedirect && viewForRedirect.rawBlog && typeof redirectFn === "function") {
            const rawBlog = viewForRedirect.rawBlog;
            const newSlug = slugifyTitle(rawBlog.getString("title"));
            const prefix = isClimbing ? "/climbing" : "/blog/posts";
            redirectFn(`${prefix}/${encodeURIComponent(newSlug)}/${rawBlog.id}`, 301);
        }
    } else if (isCanonicalPost) {
        singleBlogView = prepareBlogSingleViewData(null, !!isClimbing, params, data, req);
    }

    if (!isListView && ((isCanonicalPost && singleBlogView == null) || (!isCanonicalPost && !viewForRedirect))) {
        api.status = 404;
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
    return {
        blogposts: getAllBlogPosts("-updated"),
        climbingposts: getAllClimbingLogs("-date"),
        baseUrl: getBaseUrl(),
        slugifyTitle,
    };
}

module.exports = {
    formatDateTime,
    getBaseUrl,
    getImageUrl,
    slugifyTitle,
    escapeXml,
    escapeCdata,
    trackGAEvent,
    prepareBlogPostsViewData,
    prepareBlogSingleViewData,
    handleSinglePostRoute,
    getSitemapData,
    sanitizeSearchTerm,
    extractPreviewText,
    extractPostBadges,
    toNoCookie,
    formatPostViewModel,
    setOrUpdateMeta,
    serializePostCard,
    serializeSinglePostPayload,
    buildBlogPostsPayload,
    buildSinglePostPayload,
};

