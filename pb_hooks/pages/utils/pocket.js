const { POCKET_BLOGPOSTS } = require('./constants')
const POCKET_CLIMBING_LOGS = "climbing_logs"

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

    // Get total count for pagination
    const allRecords = $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        filter,
        "",
        0, // no limit
        0,
        filterParams
    )
    const totalItems = allRecords?.length || 0
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

module.exports = {
    getBlogPostById,
    getBlogPostsByTitlePrefix,
    getBlogPosts,
    getAllBlogPosts,
    POCKET_BLOGPOSTS,
    getClimbingLogs,
    getClimbingLogsByTitlePrefix,
    getAllClimbingLogs,
    POCKET_CLIMBING_LOGS
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
        filter += " && (title ~ {:query} || location ~ {:query} || content ~ {:query})"
        filterParams.query = query
    }
    if (climbType) {
        filter += " && climbType = {:climbType}"
        filterParams.climbType = climbType
    }

    const records = $app.findRecordsByFilter(
        POCKET_CLIMBING_LOGS,
        filter,
        "-date,-created",
        perPage,
        offset,
        filterParams
    )

    // Get total count for pagination
    const allRecords = $app.findRecordsByFilter(
        POCKET_CLIMBING_LOGS,
        filter,
        "",
        0, // no limit
        0,
        filterParams
    )
    const totalItems = allRecords?.length || 0
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
        POCKET_CLIMBING_LOGS,
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
        POCKET_CLIMBING_LOGS,
        "isDeleted = false",
        sort,
        0, // no limit (returns all)
        0
    ) || []
}


