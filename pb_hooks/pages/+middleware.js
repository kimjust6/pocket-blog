/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    return {
        siteName: "Justin's Blog",
        navigation: [
            // { title: 'Home', url: '/' },
            { title: 'My Blog Posts', url: '/blog/posts' },
        ],
    }
}
