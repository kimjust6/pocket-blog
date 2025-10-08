/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    return {
        metadata: [
            // Basic metadata
            {
                name: 'title',
                content:
                    "Keeping a record of my personal mistakes and lessons learned as a programmer.",
            },
            {
                name: 'description',
                content:
                    'Keeping a record of my personal mistakes and lessons learned as a programmer.',
            },
            { name: 'url', content: 'https://www.jkim.win/' },

            // Open Graph metadata
            {
                name: 'og:title',
                content:
                    "Keeping a record of my personal mistakes and lessons learned as a programmer.",
            },
            { name: 'og:type', content: 'website' },
            { name: 'og:url', content: 'https://www.justink.dev/' },
            {
                name: 'og:image',
                content: 'https://www.jkim.win/og-image.png',
            },
            { name: 'og:image:alt', content: 'Blog Page Photo' },
            { name: 'og:image:width', content: '1200' },
            { name: 'og:image:height', content: '630' },
            {
                name: 'og:description',
                content:
                    'Keeping a record of my personal mistakes and lessons learned as a programmer.',
            },
            { name: 'og:site_name', content: "Justin's Dank Blog" },
            { name: 'og:locale', content: 'en_CA' },

            // Encourage connection—author details
            { name: 'author', content: 'Justin Kim' },
            {
                name: 'article:author',
                content: 'https://www.justink.dev',
            },
            { name: 'article:author:name', content: 'Justin Kim' },
            { name: 'article:publisher', content: 'https://www.justink.dev/' },

            // Twitter Card metadata (optional, but helpful)
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:site', content: '@MatchaLatteTea' },
            {
                name: 'twitter:title',
                content:
                    "I'm Justin Kim — Sharing Thoughts from Behind the Console",
            },
            {
                name: 'twitter:description',
                content:
                    'Personal musings, coding thoughts, and raw insights—straight from the console.',
            },
            {
                name: 'twitter:image',
                content: 'https://www.jkim.win/og-image.png',
            },
        ],
    }
}
