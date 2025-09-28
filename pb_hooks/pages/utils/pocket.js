const POCKET_BLOGPOSTS = "blogposts"



getBlogPostById = (request, id) => {
    const client = pb({ request })
    return client
        .collection(POCKET_BLOGPOSTS)
        .getFirstListItem(
            `id = "${id}" && isDeleted = false`,
            { sort: '-created' }
        )
}


module.exports = {
    getBlogPostById
}
