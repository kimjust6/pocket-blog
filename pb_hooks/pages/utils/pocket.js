const { POCKET_BLOGPOSTS, POCKET_CLIMBING_POSTS } = require('./constants')

/**
 * Shared paginated query helper that enforces `isDeleted = false` and `page >= 1`.
 * @param {Object} opts
 * @returns {Object} Paginated result with `items`, `totalItems`, `totalPages`, `page`
 */
const getPaginatedRecords = ({
    collection,
    tableName,
    sort,
    page = 1,
    perPage = 6,
    filterClauses = [],
    filterParams = {},
    sqlConditions = [],
}) => {
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const safePerPage = Math.max(1, parseInt(perPage, 10) || 6)
    const offset = (safePage - 1) * safePerPage

    const filter = ['isDeleted = false', ...filterClauses].join(' && ')
    const records = $app.findRecordsByFilter(
        collection,
        filter,
        sort,
        safePerPage,
        offset,
        filterParams
    )

    const countResult = arrayOf(new DynamicModel({ total: 0 }))
    const queryBuilder = $app.db()
        .select('COUNT(*) as total')
        .from(tableName)
        .where($dbx.exp('isDeleted = 0'))

    sqlConditions.forEach(({ expr, params }) => {
        queryBuilder.andWhere($dbx.exp(expr, params))
    })

    queryBuilder.all(countResult)
    const totalItems = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalItems / safePerPage)

    return {
        items: records || [],
        totalItems,
        totalPages,
        page: safePage,
    }
}

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
 * Get a single climbing post by ID using server-side $app
 * @param {string} id - The climbing post ID
 * @returns {Record} The climbing post Record object
 */
const getClimbingPostById = (id) => {
    return $app.findFirstRecordByFilter(
        POCKET_CLIMBING_POSTS,
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
        0,
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
const getBlogPosts = (page = 1, perPage = 6, query = '') => {
    const filterClauses = []
    const filterParams = {}
    const sqlConditions = []

    if (query) {
        filterClauses.push("(title ~ {:query} || tags ~ {:query} || content1 ~ {:query} || content2 ~ {:query})")
        filterParams.query = query
        sqlConditions.push({
            expr: "(title LIKE {:query} OR tags LIKE {:query} OR content1 LIKE {:query} OR content2 LIKE {:query})",
            params: { query: `%${query}%` },
        })
    }

    return getPaginatedRecords({
        collection: POCKET_BLOGPOSTS,
        tableName: 'blog_posts',
        sort: '-manualPublishDate,-created',
        page,
        perPage,
        filterClauses,
        filterParams,
        sqlConditions,
    })
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
        0,
        0
    ) || []
}

/**
 * Helper to determine if a record object is from climbing_posts
 * @param {Record} record
 * @returns {boolean}
 */
function isClimbingRecord(record) {
    if (!record) return false
    if (record.collectionName === 'climbing_posts' || record.collection?.name === 'climbing_posts') return true
    if (typeof record.getString === 'function' && !!record.getString('climbType')) return true
    return false
}

/**
 * Get combined blog posts and climbing logs sorted chronologically for the homepage
 * @param {number} page
 * @param {number} perPage
 * @param {string} query
 * @returns {object} Object with items array and pagination metadata
 */
function getCombinedHomepagePosts(page = 1, perPage = 6, query = '') {
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const safePerPage = Math.max(1, parseInt(perPage, 10) || 6)
    const devPostsResult = getBlogPosts(1, 100, query)
    const climbingPostsResult = getClimbingLogs(1, 100, query)

    const allItems = [...(devPostsResult?.items || []), ...(climbingPostsResult?.items || [])]

    allItems.sort((a, b) => {
        const aIsClimb = isClimbingRecord(a)
        const bIsClimb = isClimbingRecord(b)
        const aDate = new Date(aIsClimb ? (a.getString('date') || a.getString('created')) : (a.getString('manualPublishDate') || a.getString('created')))
        const bDate = new Date(bIsClimb ? (b.getString('date') || b.getString('created')) : (b.getString('manualPublishDate') || b.getString('created')))
        return bDate - aDate
    })

    const totalItems = allItems.length
    let offset = 0
    let limit = safePerPage

    if (safePage === 1) {
        offset = 0
        limit = 7 // 1 featured/hero post + 6 grid posts
    } else {
        offset = 7 + (safePage - 2) * safePerPage
        limit = safePerPage
    }

    const items = allItems.slice(offset, offset + limit)
    const totalPages = totalItems <= 7 ? 1 : (1 + Math.ceil((totalItems - 7) / safePerPage))

    return {
        items,
        totalItems,
        totalPages,
        page: safePage,
    }
}

/**
 * Get a paginated list of climbing logs using server-side $app
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @param {string} query - Optional search query
 * @param {string} climbType - Optional climb type filter
 * @returns {object} Object with items array (Record objects) and pagination info
 */
function getClimbingLogs(page = 1, perPage = 6, query = '', climbType = '') {
    const filterClauses = []
    const filterParams = {}
    const sqlConditions = []

    if (query) {
        filterClauses.push("(title ~ {:query} || location ~ {:query} || content ~ {:query} || climbType ~ {:query} || grade ~ {:query} || style ~ {:query})")
        filterParams.query = query
        sqlConditions.push({
            expr: "(title LIKE {:query} OR location LIKE {:query} OR content LIKE {:query} OR climbType LIKE {:query} OR grade LIKE {:query} OR style LIKE {:query})",
            params: { query: `%${query}%` },
        })
    }
    if (climbType) {
        filterClauses.push("climbType = {:climbType}")
        filterParams.climbType = climbType
        sqlConditions.push({
            expr: "climbType = {:climbType}",
            params: { climbType },
        })
    }

    return getPaginatedRecords({
        collection: POCKET_CLIMBING_POSTS,
        tableName: 'climbing_posts',
        sort: '-date,-created',
        page,
        perPage,
        filterClauses,
        filterParams,
        sqlConditions,
    })
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
        0,
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
        0,
        0
    ) || []
}

module.exports = {
    getBlogPostById,
    getClimbingPostById,
    getBlogPostsByTitlePrefix,
    getBlogPosts,
    getAllBlogPosts,
    POCKET_BLOGPOSTS,
    getClimbingLogs,
    getClimbingLogsByTitlePrefix,
    getAllClimbingLogs,
    POCKET_CLIMBING_POSTS,
    isClimbingRecord,
    getCombinedHomepagePosts,
}
