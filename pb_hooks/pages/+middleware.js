/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    let cookieValue = 'dark';
    try {
        // api.request.cookies is a function in the JS bridge
        const cookiesMap = api.request.cookies();

        // Check if theme cookie exists
        // cookiesMap might be an object where keys are cookie names
        if (cookiesMap && cookiesMap.theme) {
            // value might be the string directly or an object with .value
            cookieValue = cookiesMap.theme.value || cookiesMap.theme;
        }
    } catch (e) {
        console.log("Error reading cookies:", e);
    }

    return {
        metadata: [
            // Basic metadata
            {
                name: 'title',
                content:
                    "The Justin Blog",
            },
            {
                name: 'description',
                content:
                    'Keeping a personal record of my mistakes and lessons learned as a developer.',
            },
            { name: 'url', content: 'https://www.jkim.win/' },

            // Open Graph metadata
            {
                name: 'og:title',
                content:
                    "The Justin Blog",
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
                    'Keeping a personal record of my mistakes and lessons learned as a developer.',
            },
            { name: 'og:site_name', content: "The Justin Blog" },
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
                    "The Justin Blog",
            },
            {
                name: 'twitter:description',
                content:
                    'Keeping a personal record of my mistakes and lessons learned as a developer.',
            },
            {
                name: 'twitter:image',
                content: 'https://www.jkim.win/og-image.png',
            },
        ],
        theme: cookieValue,
        navigation: [
            { title: 'Development', url: '/blog/posts' },
            { title: 'Climbing', url: '/climbing' }
        ]
    }
}
