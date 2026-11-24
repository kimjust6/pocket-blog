const {
    DEFAULT_BASE_URL,
    getPostTypeConfig,
} = require("./constants.js");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a Date as `Mon DD, YYYY`, returning `""` for invalid dates.
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
    }
    const month = MONTHS[date.getMonth()];
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

/**
 * Resolve the canonical site base URL from PocketBase settings or fallback constant.
 * @returns {string}
 */
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
 * Build the canonical relative URL path for a blog post or climbing log.
 * @param {string} id
 * @param {string} title
 * @param {boolean} isClimbing
 * @returns {string}
 */
function getPostUrl(id, title, isClimbing) {
    const slug = slugifyTitle(title);
    const { routePrefix } = getPostTypeConfig(isClimbing);
    return `${routePrefix}/${encodeURIComponent(slug)}/${id}`;
}

/**
 * Resolve the primary publish/log date string for a post record.
 * @param {Object} record
 * @param {boolean} isClimbing
 * @returns {string}
 */
function getPostDateRaw(record, isClimbing) {
    const { dateField } = getPostTypeConfig(isClimbing);
    return record.getString(dateField) || record.getString("created");
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
 * Compute word count and formatted reading time from a post record's content fields.
 * @param {Object} record
 * @param {boolean} isClimbing
 * @returns {{ wordCount: number, readMinutes: number, readingTime: string }}
 */
function getReadingStats(record, isClimbing) {
    const { contentFields } = getPostTypeConfig(isClimbing);
    const rawContent = contentFields.map((field) => record.getString(field) || "").join(" ");
    const cleanFull = extractPreviewText(rawContent);
    const wordCount = cleanFull ? cleanFull.trim().split(/\s+/).filter(Boolean).length : 0;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));
    return {
        wordCount,
        readMinutes,
        readingTime: `${readMinutes} min read`,
    };
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
 * @param {Object} record
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
 * @param {Object} record
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

module.exports = {
    formatDateTime,
    getBaseUrl,
    getImageUrl,
    slugifyTitle,
    getPostUrl,
    getPostDateRaw,
    escapeXml,
    escapeCdata,
    extractPreviewText,
    getReadingStats,
    toNoCookie,
    extractPostBadges,
    resolvePostImage,
};
