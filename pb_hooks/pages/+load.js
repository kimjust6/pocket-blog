/** @type {import('pocketpages').PageDataLoaderFunc} */
module.exports = function (api) {
    return {
        siteName: "Justin's Blog",
        navigation: [
            // { title: 'Home', url: '/' },
            { title: 'My Blog Posts', url: '/blog/posts' },
        ],
    }
}
