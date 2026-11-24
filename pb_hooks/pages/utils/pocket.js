const {
    POCKET_BLOGPOSTS,
    POCKET_CLIMBING_POSTS,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    getPostTypeConfig,
} = require('./constants')

/**
 * Read a setting value from PocketBase `admin_settings` by key.
 * @param {string} key
 * @returns {string|null}
 */
function getAdminSetting(key) {
    if (!key || typeof $app === 'undefined') {
        return null
    }
    const record = new Record()
    try {
        $app.recordQuery(POCKET_COLLECTION_ADMIN_SETTINGS)
            .andWhere($dbx.hashExp({ key }))
            .limit(1)
            .one(record)
    } catch (err) {
        $app.logger().error('Error querying admin settings:', 'error', err)
        return null
    }
    return record.get('value') ?? null
}

/**
 * Resolve a configuration value from environment variables first, falling back to `admin_settings`.
 * @param {string} envVarName
 * @param {string} [adminSettingKey]
 * @returns {string}
 */
function getConfigValue(envVarName, adminSettingKey = '') {
    try {
        if (envVarName && typeof process !== 'undefined' && process?.env?.[envVarName]) {
            const trimmed = String(process.env[envVarName]).trim()
            if (trimmed) return trimmed
        }
    } catch (_) {}

    if (adminSettingKey) {
        try {
            const dbVal = getAdminSetting(adminSettingKey)
            if (dbVal) return String(dbVal).trim()
        } catch (_) {}
    }

    return ''
}

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

const getPostById = (collection, id) => {
    return $app.findFirstRecordByFilter(
        collection,
        "id = {:id} && isDeleted = false",
        { id }
    )
}

const getPostsByTitlePrefix = (collection, sort, titlePrefix) => {
    return $app.findRecordsByFilter(
        collection,
        "title ~ {:titlePrefix} && isDeleted = false",
        sort,
        0,
        0,
        { titlePrefix }
    ) || []
}

const getAllPosts = (collection, sort) => {
    return $app.findRecordsByFilter(
        collection,
        "isDeleted = false",
        sort,
        0,
        0
    ) || []
}

/**
 * Get a single blog post by ID using server-side $app
 * @param {string} id - The blog post ID
 * @returns {Record} The blog post Record object (use .getString(), .get() to access fields)
 */
const getBlogPostById = (id) => getPostById(POCKET_BLOGPOSTS, id)

/**
 * Get a single climbing post by ID using server-side $app
 * @param {string} id - The climbing post ID
 * @returns {Record} The climbing post Record object
 */
const getClimbingPostById = (id) => getPostById(POCKET_CLIMBING_POSTS, id)

/**
 * Get blog posts by title prefix using server-side $app
 * @param {string} titlePrefix - The prefix of the title to search for
 * @returns {array} Array of blog post Record objects
 */
const getBlogPostsByTitlePrefix = (titlePrefix) =>
    getPostsByTitlePrefix(POCKET_BLOGPOSTS, "-manualPublishDate,-updated", titlePrefix)

/**
 * Build matching PocketBase filter clauses and SQL COUNT conditions from a single field list,
 * preventing pagination counts from drifting out of sync with record queries.
 * @param {string[]} fields
 * @param {string} query
 * @returns {{ filterClause: string|null, filterParams: Object, sqlCondition: Object|null }}
 */
const buildSearchFilter = (fields, query) => {
    const words = String(query || '').trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
        return { filterClause: null, filterParams: {}, sqlCondition: null }
    }

    const filterParams = {}
    const sqlParams = {}
    const pbWordClauses = []
    const sqlWordClauses = []

    words.forEach((word, i) => {
        const key = words.length > 1 ? `qw_${i}` : 'query'
        filterParams[key] = word
        sqlParams[key] = `%${word}%`
        pbWordClauses.push(`(${fields.map((f) => `${f} ~ {:${key}}`).join(' || ')})`)
        sqlWordClauses.push(`(${fields.map((f) => `${f} LIKE {:${key}}`).join(' OR ')})`)
    })

    return {
        filterClause: pbWordClauses.length > 1 ? `(${pbWordClauses.join(' && ')})` : pbWordClauses[0],
        filterParams,
        sqlCondition: {
            expr: sqlWordClauses.length > 1 ? `(${sqlWordClauses.join(' AND ')})` : sqlWordClauses[0],
            params: sqlParams,
        },
    }
}

/**
 * Get a paginated list of blog posts using server-side $app
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @param {string} query - Optional search query
 * @returns {object} Object with items array (Record objects) and pagination info
 */
const getBlogPosts = (page = 1, perPage = 6, query = '') => {
    const cfg = getPostTypeConfig(false)
    const filterClauses = []
    let filterParams = {}
    const sqlConditions = []

    if (query) {
        const search = buildSearchFilter(cfg.searchFields, query)
        if (search.filterClause) {
            filterClauses.push(search.filterClause)
            filterParams = Object.assign(filterParams, search.filterParams)
            sqlConditions.push(search.sqlCondition)
        }
    }

    return getPaginatedRecords({
        collection: cfg.collection,
        tableName: cfg.tableName,
        sort: cfg.sort,
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
const getAllBlogPosts = (sort = "-updated") => getAllPosts(POCKET_BLOGPOSTS, sort)

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
    const offset = safePage === 1 ? 0 : 7 + (safePage - 2) * safePerPage
    const limit = safePage === 1 ? 7 : safePerPage

    if (!String(query || '').trim()) {
        const unionSql = `
            SELECT id, 'blog_posts' AS col, COALESCE(NULLIF(manualPublishDate, ''), created) AS sortDate
            FROM blog_posts WHERE isDeleted = 0
            UNION ALL
            SELECT id, 'climbing_posts' AS col, COALESCE(NULLIF(date, ''), created) AS sortDate
            FROM climbing_posts WHERE isDeleted = 0
        `
        const countRows = arrayOf(new DynamicModel({ total: 0 }))
        $app.db().newQuery(`SELECT COUNT(*) AS total FROM (${unionSql})`).all(countRows)
        const totalItems = countRows[0]?.total || 0

        const pageRows = arrayOf(new DynamicModel({ id: '', col: '', sortDate: '' }))
        $app.db()
            .newQuery(`${unionSql} ORDER BY sortDate DESC LIMIT {:limit} OFFSET {:offset}`)
            .bind({ limit, offset })
            .all(pageRows)

        const blogIds = pageRows.filter((r) => r.col === 'blog_posts').map((r) => r.id)
        const climbIds = pageRows.filter((r) => r.col === 'climbing_posts').map((r) => r.id)

        const recordMap = new Map()
        if (blogIds.length > 0) {
            ($app.findRecordsByIds(POCKET_BLOGPOSTS, blogIds) || []).forEach((r) => recordMap.set(`blog_posts:${r.id}`, r))
        }
        if (climbIds.length > 0) {
            ($app.findRecordsByIds(POCKET_CLIMBING_POSTS, climbIds) || []).forEach((r) => recordMap.set(`climbing_posts:${r.id}`, r))
        }

        const items = pageRows.map((r) => recordMap.get(`${r.col}:${r.id}`)).filter(Boolean)
        const totalPages = totalItems <= 7 ? 1 : 1 + Math.ceil((totalItems - 7) / safePerPage)
        return { items, totalItems, totalPages, page: safePage }
    }

    const neededOffset = safePage === 1 ? 7 : 7 + (safePage - 1) * safePerPage
    const fetchLimit = Math.max(60, neededOffset + safePerPage * 2)

    const devPostsResult = getBlogPosts(1, fetchLimit, query)
    const climbingPostsResult = getClimbingLogs(1, fetchLimit, query)

    const allItems = [...(devPostsResult?.items || []), ...(climbingPostsResult?.items || [])]

    allItems.sort((a, b) => {
        const aIsClimb = isClimbingRecord(a)
        const bIsClimb = isClimbingRecord(b)
        const aDate = new Date(aIsClimb ? (a.getString('date') || a.getString('created')) : (a.getString('manualPublishDate') || a.getString('created')))
        const bDate = new Date(bIsClimb ? (b.getString('date') || b.getString('created')) : (b.getString('manualPublishDate') || b.getString('created')))
        return bDate - aDate
    })

    const totalItems = (devPostsResult?.totalItems || 0) + (climbingPostsResult?.totalItems || 0)
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
    const cfg = getPostTypeConfig(true)
    const filterClauses = []
    let filterParams = {}
    const sqlConditions = []

    if (query) {
        const search = buildSearchFilter(cfg.searchFields, query)
        if (search.filterClause) {
            filterClauses.push(search.filterClause)
            filterParams = Object.assign(filterParams, search.filterParams)
            sqlConditions.push(search.sqlCondition)
        }
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
        collection: cfg.collection,
        tableName: cfg.tableName,
        sort: cfg.sort,
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
    return getPostsByTitlePrefix(POCKET_CLIMBING_POSTS, "-date,-created", titlePrefix)
}

/**
 * Get all climbing logs using server-side $app
 * @param {string} sort - Sort order (e.g., "-date", "-created")
 * @returns {array} Array of climbing log Record objects
 */
function getAllClimbingLogs(sort = "-date") {
    return getAllPosts(POCKET_CLIMBING_POSTS, sort)
}

/**
 * Get adjacent (previous older and next newer) post records relative to a post
 * @param {Record} currentRecord
 * @param {boolean} isClimbing
 * @returns {{ prev: Record|null, next: Record|null }}
 */
function getAdjacentPosts(currentRecord, isClimbing = false) {
    if (!currentRecord) return { prev: null, next: null };
    const collection = isClimbing ? POCKET_CLIMBING_POSTS : POCKET_BLOGPOSTS;
    const sortField = isClimbing ? 'date' : 'manualPublishDate';
    const dateVal = currentRecord.getString(sortField) || currentRecord.getString('created');
    const currentCreated = currentRecord.getString('created');
    const currentId = currentRecord.id;

    let prev = null;
    let next = null;

    try {
        // Older post (prev)
        const older = $app.findRecordsByFilter(
            collection,
            `isDeleted = false && id != {:id} && (${sortField} < {:date} || (${sortField} = {:date} && created < {:created}))`,
            `-${sortField},-created`,
            1,
            0,
            { id: currentId, date: dateVal, created: currentCreated }
        );
        if (older && older.length > 0) prev = older[0];
    } catch (_) {}

    try {
        // Newer post (next)
        const newer = $app.findRecordsByFilter(
            collection,
            `isDeleted = false && id != {:id} && (${sortField} > {:date} || (${sortField} = {:date} && created > {:created}))`,
            `+${sortField},+created`,
            1,
            0,
            { id: currentId, date: dateVal, created: currentCreated }
        );
        if (newer && newer.length > 0) next = newer[0];
    } catch (_) {}

    return { prev, next };
}

/**
 * Calculate aggregate climbing statistics for the climbing overview
 * @returns {object}
 */
function getClimbingStats() {
    try {
        const records = getAllClimbingLogs("-date");
        const totalClimbs = records.length;
        let sends = 0;
        let flashes = 0;
        let onsights = 0;
        let projects = 0;
        const typeCounts = {};
        const locations = new Set();

        records.forEach((r) => {
            const style = r.getString("style");
            if (style === "Send") sends++;
            else if (style === "Flash") flashes++;
            else if (style === "Onsight") onsights++;
            else if (style === "Project") projects++;

            const type = r.getString("climbType") || "Other";
            typeCounts[type] = (typeCounts[type] || 0) + 1;

            const loc = r.getString("location");
            if (loc && loc.trim()) locations.add(loc.trim());
        });

        return {
            totalClimbs,
            totalSends: sends + flashes + onsights,
            flashes,
            onsights,
            projects,
            uniqueLocations: locations.size,
            typeCounts,
        };
    } catch (_) {
        return {
            totalClimbs: 0,
            totalSends: 0,
            flashes: 0,
            onsights: 0,
            projects: 0,
            uniqueLocations: 0,
            typeCounts: {},
        };
    }
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
    buildSearchFilter,
    getCombinedHomepagePosts,
    getAdjacentPosts,
    getClimbingStats,
    getAdminSetting,
    getConfigValue,
}
