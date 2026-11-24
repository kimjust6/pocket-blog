const {
    SITE_NAME,
    AUTHOR_NAME,
    AUTHOR_URL,
    TWITTER_HANDLE,
    getPostTypeConfig,
} = require("./constants.js");
const {
    getBaseUrl,
    getImageUrl,
    getPostUrl,
    getPostDateRaw,
    extractPreviewText,
    getReadingStats,
} = require("./format.js");

const STATIC_PAGE_METADATA = {
    faq: (baseUrl) => ({
        title: `Frequently Asked Questions (FAQ) | ${SITE_NAME}`,
        ogTitle: `Frequently Asked Questions | ${SITE_NAME}`,
        description: `Frequently asked questions about ${AUTHOR_NAME}'s software development work, tech stack, and climbing journal.`,
        url: `${baseUrl}/faq`,
        siteName: SITE_NAME,
    }),
    privacy: (baseUrl) => {
        const title = `Privacy Policy | ${SITE_NAME}`;
        return {
            title,
            ogTitle: title,
            description: `Privacy Policy and data protection details for ${SITE_NAME}.`,
            url: `${baseUrl}/privacy`,
            siteName: SITE_NAME,
        };
    },
    terms: (baseUrl) => {
        const title = `Terms of Service | ${SITE_NAME}`;
        return {
            title,
            ogTitle: title,
            description: `Terms of Service and conditions of use for ${SITE_NAME}.`,
            url: `${baseUrl}/terms`,
            siteName: SITE_NAME,
        };
    },
};

/**
 * Update an existing metadata entry or append a new one.
 * @param {Array<Object>} metadata
 * @param {string} name
 * @param {*} content
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
 * @param {Array<Object>} metadata
 * @param {{ title: string, ogTitle: string, description: string, url: string, siteName: string }} opts
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
 * Apply metadata for static and error pages (FAQ, Privacy, Terms, Not Found).
 * @param {Array<Object>} metadata
 * @param {string} pageType - 'faq' | 'privacy' | 'terms' | 'notfound'
 */
function applyStaticPageMetadata(metadata, pageType) {
    if (!metadata || !Array.isArray(metadata)) return;
    if (pageType === "notfound") {
        const title = `404 - Page Not Found | ${SITE_NAME}`;
        setOrUpdateMeta(metadata, "title", title);
        setOrUpdateMeta(metadata, "og:title", title);
        setOrUpdateMeta(metadata, "twitter:title", title);
        setOrUpdateMeta(metadata, "robots", "noindex, nofollow");
        return;
    }

    const factory = STATIC_PAGE_METADATA[pageType];
    if (factory) {
        applySectionMeta(metadata, factory(getBaseUrl()));
    }
}

/**
 * Populate SEO/OpenGraph/Twitter metadata for a resolved single post or climbing log.
 * Pure metadata mutation (no analytics side effects).
 * @param {Object} singleBlog
 * @param {boolean} isClimbing
 * @param {Array<Object>} metadata
 */
function applySinglePostMetadata(singleBlog, isClimbing, metadata) {
    const postTitle = singleBlog.getString("title") || "";
    const baseUrl = getBaseUrl();
    const canonicalUrl = `${baseUrl}${getPostUrl(singleBlog.id, postTitle, isClimbing)}`;

    const pageTitle = isClimbing ? `${postTitle} | Climbing Blog` : `${postTitle} | ${SITE_NAME}`;
    setOrUpdateMeta(metadata, "title", pageTitle);
    setOrUpdateMeta(metadata, "og:title", postTitle);
    setOrUpdateMeta(metadata, "twitter:title", postTitle);

    const { wordCount, readMinutes } = getReadingStats(singleBlog, isClimbing);
    if (wordCount > 0) {
        setOrUpdateMeta(metadata, "article:word_count", String(wordCount));
        setOrUpdateMeta(metadata, "article:reading_time", `PT${readMinutes}M`);
        setOrUpdateMeta(metadata, "twitter:label1", "Reading time");
        setOrUpdateMeta(metadata, "twitter:data1", `${readMinutes} min read`);
    }

    const rawLeadContent = singleBlog.getString(isClimbing ? "content" : "content1") || "";
    let metaDescription = extractPreviewText(rawLeadContent);
    if (metaDescription.length > 155) {
        metaDescription = metaDescription.slice(0, 155).replace(/\s+\S*$/, "") + "...";
    }
    if (!metaDescription) {
        metaDescription = isClimbing
            ? `Climbing journal log by ${AUTHOR_NAME}.`
            : `Blog post by ${AUTHOR_NAME}.`;
    }

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

    const { sectionLabel } = getPostTypeConfig(isClimbing);
    setOrUpdateMeta(metadata, "author", AUTHOR_NAME);
    setOrUpdateMeta(metadata, "article:author", AUTHOR_URL);
    setOrUpdateMeta(metadata, "article:author:name", AUTHOR_NAME);
    setOrUpdateMeta(metadata, "article:publisher", `${AUTHOR_URL}/`);
    setOrUpdateMeta(metadata, "article:section", sectionLabel);

    const publishedDate = getPostDateRaw(singleBlog, isClimbing);
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
}

/**
 * Build Schema.org JSON-LD `@graph` payload for the layout template.
 * @param {Object} data
 * @returns {Object}
 */
function buildJsonLdGraph(data) {
    const metadata = data?.metadata || [];
    const metaGet = (key) => metadata.find((m) => m.name === key)?.content;
    const isArticle = metaGet("og:type") === "article";
    const baseUrl = data?.baseUrl || getBaseUrl();
    const pageCanonical = metaGet("og:url") || metaGet("url") || `${baseUrl}/`;
    const pageTitle = metaGet("title") || metaGet("og:title") || data?.siteName || SITE_NAME;
    const pageDesc = metaGet("description") || metaGet("og:description") || data?.siteDescription || "";
    const pageImg = metaGet("og:image") || `${baseUrl}/og-image.png`;
    const currentPath = data?.currentPath || "/";

    const breadcrumbItems = [
        {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${baseUrl}/`,
        },
    ];

    let isCollection = false;
    const staticRouteNames = {
        "/faq": "FAQ",
        "/privacy": "Privacy Policy",
        "/terms": "Terms of Service",
    };

    if (currentPath.startsWith("/blog/posts") || currentPath.startsWith("/blog")) {
        breadcrumbItems.push({
            "@type": "ListItem",
            position: 2,
            name: "Development",
            item: `${baseUrl}/blog/posts`,
        });
        if (isArticle) {
            breadcrumbItems.push({
                "@type": "ListItem",
                position: 3,
                name: metaGet("og:title") || pageTitle,
                item: pageCanonical,
            });
        } else {
            isCollection = true;
        }
    } else if (currentPath.startsWith("/climbing")) {
        breadcrumbItems.push({
            "@type": "ListItem",
            position: 2,
            name: "Climbing",
            item: `${baseUrl}/climbing`,
        });
        if (isArticle) {
            breadcrumbItems.push({
                "@type": "ListItem",
                position: 3,
                name: metaGet("og:title") || pageTitle,
                item: pageCanonical,
            });
        } else {
            isCollection = true;
        }
    } else {
        const matchedPrefix = Object.keys(staticRouteNames).find((p) => currentPath.startsWith(p));
        if (matchedPrefix) {
            breadcrumbItems.push({
                "@type": "ListItem",
                position: 2,
                name: staticRouteNames[matchedPrefix],
                item: `${baseUrl}${matchedPrefix}`,
            });
        }
    }

    const graph = [
        {
            "@type": "WebSite",
            "@id": `${baseUrl}/#website`,
            url: `${baseUrl}/`,
            name: data?.siteName || SITE_NAME,
            description: data?.siteDescription || "",
            inLanguage: "en-CA",
            publisher: {
                "@type": "Person",
                "@id": `${baseUrl}/#author`,
            },
            potentialAction: {
                "@type": "SearchAction",
                target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${baseUrl}/blog/posts?query={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
            },
        },
        {
            "@type": "Person",
            "@id": `${baseUrl}/#author`,
            name: data?.authorName || AUTHOR_NAME,
            url: data?.authorUrl || AUTHOR_URL,
            image: {
                "@type": "ImageObject",
                "@id": `${baseUrl}/#authorImage`,
                url: `${baseUrl}/icon-192.png`,
                caption: data?.authorName || AUTHOR_NAME,
            },
            sameAs: (data?.socials || []).map((s) => s.url).filter(Boolean),
        },
        {
            "@type": "BreadcrumbList",
            "@id": `${pageCanonical}#breadcrumb`,
            itemListElement: breadcrumbItems,
        },
    ];

    if (isArticle) {
        const articleSchema = {
            "@type": "BlogPosting",
            "@id": `${pageCanonical}#article`,
            isPartOf: {
                "@type": "WebPage",
                "@id": pageCanonical,
            },
            mainEntityOfPage: pageCanonical,
            headline: metaGet("og:title") || pageTitle,
            description: pageDesc,
            image: {
                "@type": "ImageObject",
                url: pageImg,
                width: 1200,
                height: 630,
            },
            inLanguage: "en-CA",
            breadcrumb: {
                "@id": `${pageCanonical}#breadcrumb`,
            },
            author: { "@id": `${baseUrl}/#author` },
            publisher: { "@id": `${baseUrl}/#author` },
        };

        const pubTime = metaGet("article:published_time");
        if (pubTime) articleSchema.datePublished = pubTime;
        const modTime = metaGet("article:modified_time") || pubTime;
        if (modTime) articleSchema.dateModified = modTime;
        const keywords = metaGet("keywords");
        if (keywords) articleSchema.keywords = keywords;
        const section = metaGet("article:section");
        if (section) articleSchema.articleSection = section;

        const wordCount = metaGet("article:word_count");
        if (wordCount) articleSchema.wordCount = parseInt(wordCount, 10);
        const readingTime = metaGet("article:reading_time");
        if (readingTime) articleSchema.timeRequired = readingTime;

        graph.push(articleSchema);
    } else {
        graph.push({
            "@type": isCollection ? "CollectionPage" : "WebPage",
            "@id": pageCanonical,
            url: pageCanonical,
            name: pageTitle,
            description: pageDesc,
            isPartOf: { "@id": `${baseUrl}/#website` },
            breadcrumb: { "@id": `${pageCanonical}#breadcrumb` },
            inLanguage: "en-CA",
        });
    }

    return {
        "@context": "https://schema.org",
        "@graph": graph,
    };
}

module.exports = {
    setOrUpdateMeta,
    applySectionMeta,
    applyStaticPageMetadata,
    applySinglePostMetadata,
    buildJsonLdGraph,
};
