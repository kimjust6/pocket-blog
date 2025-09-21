/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    return {
        metadata: [
            // Basic metadata
            {
                name: 'title',
                content:
                    "I'm Justin Kim — Sharing Thoughts from Behind the Console",
            },
            {
                name: 'description',
                content:
                    'I\'m Justin Kim — a programmer sharing unfiltered insights, musings, and the occasional "Console.WriteLine(…)" moment.',
            },
            { name: 'url', content: 'https://blog.jkim.win/' },

            // Open Graph metadata
            {
                name: 'og:title',
                content:
                    "I'm Justin Kim — Sharing Thoughts from Behind the Console",
            },
            { name: 'og:type', content: 'website' },
            { name: 'og:url', content: 'https://www.justink.dev/' },
            {
                name: 'og:image',
                content: 'https://blog.jkim.win/og-image.png',
            }, // replace with real image
            { name: 'og:image:alt', content: 'Blog Page Photo' },
            { name: 'og:image:width', content: '1200' },
            { name: 'og:image:height', content: '630' },
            {
                name: 'og:description',
                content:
                    'Unfiltered reflections and insights from Justin Kim — capturing personal thoughts one "Console.WriteLine" at a time.',
            },
            { name: 'og:site_name', content: "Justin Kim's Blog" },
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
                content: 'https://blog.jkim.win/og-image.png',
            },
        ],
    }
}
