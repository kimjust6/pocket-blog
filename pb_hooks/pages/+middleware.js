/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    return {
        metadata: [
            // Basic metadata
            { name: 'title', content: 'Snapshots of My Thoughts' },
            {
                name: 'description',
                content:
                    'Unfiltered personal reflections and insights—straight from the mind behind the console.',
            },
            { name: 'url', content: 'https://blog.jkim.win/' },

            // Open Graph metadata
            { name: 'og:title', content: 'Snapshots of My Thoughts' },
            { name: 'og:type', content: 'website' },
            { name: 'og:url', content: 'https://blog.jkim.win/' },
            {
                name: 'og:image',
                content: 'https://blog.jkim.win/og-image.png',
            },
            {
                name: 'og:description',
                content:
                    'Unfiltered personal reflections and insights—straight from the mind behind the console.',
            },
            { name: 'og:site_name', content: "Justin's Blog" },
            { name: 'og:locale', content: 'en_CA' },

            // Author / article-specific
            {
                name: 'article:author',
                content: 'https://www.linkedin.com/in/jkim',
            },
            { name: 'article:author:name', content: 'Justin Kim' },
            { name: 'article:publisher', content: 'https://www.justink.dev/' },
        ],
    }
}
