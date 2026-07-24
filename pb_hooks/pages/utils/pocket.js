const { POCKET_BLOGPOSTS, POCKET_CLIMBING_POSTS } = require('./constants')

/**
 * Get a single blog post by ID using server-side $app
 * @param {string} id - The blog post ID
 * @returns {Record} The blog post Record object (use .getString(), .get() to access fields)
 */
const getBlogPostById = (id) => {
    return $app.findFirstRecordByFilter(
        POCKET_BLOGPOSTS,
        "id = {:id} && isDeleted = false",
        { id }
    )
}

/**
 * Get blog posts by title prefix using server-side $app
 * @param {string} titlePrefix - The prefix of the title to search for
 * @returns {array} Array of blog post Record objects
 */
const getBlogPostsByTitlePrefix = (titlePrefix) => {
    return $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        "title ~ {:titlePrefix} && isDeleted = false",
        "-manualPublishDate,-updated",
        0, // no limit
        0,
        { titlePrefix }
    ) || []
}

/**
 * Get a paginated list of blog posts using server-side $app
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @param {string} query - Optional search query
 * @returns {object} Object with items array (Record objects) and pagination info
 */
const getBlogPosts = (page, perPage, query) => {
    const offset = (page - 1) * perPage
    let filter = "isDeleted = false"
    let filterParams = {}

    if (query) {
        filter = "isDeleted = false && (title ~ {:query} || tags ~ {:query} || content1 ~ {:query} || content2 ~ {:query})"
        filterParams = { query }
    }

    const records = $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        filter,
        "-manualPublishDate,-created",
        perPage,
        offset,
        filterParams
    )

    // Get total count for pagination using efficient DB query
    const countResult = arrayOf(new DynamicModel({
        "total": 0
    }))

    let queryBuilder = $app.db()
        .select("COUNT(*) as total")
        .from("blog_posts")
        .where($dbx.exp("isDeleted = 0"))

    if (query) {
        queryBuilder.andWhere(
            $dbx.exp(
                "(title LIKE {:query} OR tags LIKE {:query} OR content1 LIKE {:query} OR content2 LIKE {:query})",
                { query: `%${query}%` }
            )
        )
    }

    queryBuilder.all(countResult)
    const totalItems = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalItems / perPage)

    return {
        items: records || [],
        totalItems,
        totalPages,
        page
    }
}

/**
 * Get all blog posts (for sitemap/RSS) using server-side $app
 * @param {string} sort - Sort order (e.g., "-updated", "-created")
 * @returns {array} Array of blog post Record objects
 */
const getAllBlogPosts = (sort = "-updated") => {
    return $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        "isDeleted = false",
        sort,
        0, // no limit (returns all)
        0
    ) || []
}

/**
 * Helper to determine if a record object is from climbing_posts
 * @param {Record} record 
 * @returns {boolean}
 */
function isClimbingRecord(record) {
    if (!record) return false;
    if (record.collectionName === 'climbing_posts' || record.collection?.name === 'climbing_posts') return true;
    if (typeof record.getString === 'function' && !!record.getString('climbType')) return true;
    return false;
}

/**
 * Get combined blog posts and climbing logs sorted chronologically for the homepage
 * @param {number} page 
 * @param {number} perPage 
 * @param {string} query 
 * @returns {object} Object with items array and pagination metadata
 */
function getCombinedHomepagePosts(page = 1, perPage = 7, query = '') {
    const offset = (page - 1) * perPage;
    const devPostsResult = getBlogPosts(1, 100, query);
    const climbingPostsResult = getClimbingLogs(1, 100, query);

    const allItems = [...(devPostsResult?.items || []), ...(climbingPostsResult?.items || [])];

    allItems.sort((a, b) => {
        const aIsClimb = isClimbingRecord(a);
        const bIsClimb = isClimbingRecord(b);
        const aDate = new Date(aIsClimb ? (a.getString('date') || a.getString('created')) : (a.getString('manualPublishDate') || a.getString('created')));
        const bDate = new Date(bIsClimb ? (b.getString('date') || b.getString('created')) : (b.getString('manualPublishDate') || b.getString('created')));
        return bDate - aDate;
    });

    const items = allItems.slice(offset, offset + perPage);
    const totalItems = allItems.length;
    const totalPages = Math.ceil(totalItems / perPage) || 1;

    return {
        items,
        totalItems,
        totalPages,
        page
    };
}

module.exports = {
    getBlogPostById,
    getBlogPostsByTitlePrefix,
    getBlogPosts,
    getAllBlogPosts,
    POCKET_BLOGPOSTS,
    getClimbingLogs,
    getClimbingLogsByTitlePrefix,
    getAllClimbingLogs,
    POCKET_CLIMBING_POSTS,
    isClimbingRecord,
    getCombinedHomepagePosts
}


/**
 * Get a paginated list of climbing logs using server-side $app
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @param {string} query - Optional search query
 * @param {string} climbType - Optional climb type filter
 * @returns {object} Object with items array (Record objects) and pagination info
 */
function getClimbingLogs(page, perPage, query, climbType) {
    const offset = (page - 1) * perPage
    let filter = "isDeleted = false"
    let filterParams = {}

    if (query) {
        filter += " && (title ~ {:query} || location ~ {:query} || content ~ {:query} || climbType ~ {:query} || grade ~ {:query} || style ~ {:query})"
        filterParams.query = query
    }
    if (climbType) {
        filter += " && climbType = {:climbType}"
        filterParams.climbType = climbType
    }

    const records = $app.findRecordsByFilter(
        POCKET_CLIMBING_POSTS,
        filter,
        "-date,-created",
        perPage,
        offset,
        filterParams
    )

    // Get total count for pagination using efficient DB query
    const countResult = arrayOf(new DynamicModel({
        "total": 0
    }))

    let queryBuilder = $app.db()
        .select("COUNT(*) as total")
        .from("climbing_posts")
        .where($dbx.exp("isDeleted = 0"))

    if (query) {
        queryBuilder.andWhere(
            $dbx.exp(
                "(title LIKE {:query} OR location LIKE {:query} OR content LIKE {:query} OR climbType LIKE {:query} OR grade LIKE {:query} OR style LIKE {:query})",
                { query: `%${query}%` }
            )
        )
    }
    if (climbType) {
        queryBuilder.andWhere(
            $dbx.exp("climbType = {:climbType}", { climbType })
        )
    }

    queryBuilder.all(countResult)
    const totalItems = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalItems / perPage)

    return {
        items: records || [],
        totalItems,
        totalPages,
        page
    }
}

/**
 * Get climbing logs by title prefix using server-side $app (for slugs)
 * @param {string} titlePrefix - The prefix of the title to search for
 * @returns {array} Array of climbing log Record objects
 */
function getClimbingLogsByTitlePrefix(titlePrefix) {
    return $app.findRecordsByFilter(
        POCKET_CLIMBING_POSTS,
        "title ~ {:titlePrefix} && isDeleted = false",
        "-date,-created",
        0, // no limit
        0,
        { titlePrefix }
    ) || []
}

/**
 * Get all climbing logs using server-side $app
 * @param {string} sort - Sort order (e.g., "-date", "-created")
 * @returns {array} Array of climbing log Record objects
 */
function getAllClimbingLogs(sort = "-date") {
    return $app.findRecordsByFilter(
        POCKET_CLIMBING_POSTS,
        "isDeleted = false",
        sort,
        0, // no limit (returns all)
        0
    ) || []
}


