const { globalApi } = require('pocketpages')
const { dbg, stringify } = globalApi

function getNavbar() {
    return {
        navigation: [{ title: 'My Blog Posts', url: '/blog/posts' }],
    }
}

function getSiteName() {
    return { siteName: "Justin's Blog" }
}

module.exports = { getNavbar, getSiteName }
