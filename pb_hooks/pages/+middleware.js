const {
    SITE_NAME,
    SITE_DESCRIPTION,
    AUTHOR_NAME,
    AUTHOR_URL,
    TWITTER_HANDLE,
    GA_MEASUREMENT_ID,
    SITE_NAVIGATION,
    SITE_SOCIALS,
} = require('./utils/constants.js');
const { getBaseUrl } = require('./utils/blog.js');

/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    let cookieValue = 'dark';
    try {
        // api.request.cookies is a function in the JS bridge
        const cookiesMap = api.request.cookies();

        if (cookiesMap && cookiesMap.theme) {
            cookieValue = cookiesMap.theme.value || cookiesMap.theme;
        }
    } catch (e) {
        console.log('Error reading cookies:', e);
    }

    let pathname = '/';
    try {
        if (api.request?.url?.pathname) {
            pathname = api.request.url.pathname;
        }
    } catch (_) {}

    try {
        if (api.response?.header) {
            api.response.header('Cache-Control', 'no-cache, private, must-revalidate');
            api.response.header('Vary', 'Cookie');
        }
    } catch (_) {}

    const baseUrl = getBaseUrl();
    const pageUrl = pathname === '/' ? `${baseUrl}/` : `${baseUrl}${pathname}`;
    const defaultOgImage = `${baseUrl}/og-image.png`;

    return {
        currentPath: pathname,
        baseUrl,
        siteName: SITE_NAME,
        siteDescription: SITE_DESCRIPTION,
        authorName: AUTHOR_NAME,
        authorUrl: AUTHOR_URL,
        gaMeasurementId: GA_MEASUREMENT_ID,
        metadata: [
            // Basic metadata
            { name: 'title', content: SITE_NAME },
            { name: 'description', content: SITE_DESCRIPTION },
            { name: 'url', content: pageUrl },
            { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },

            // Open Graph metadata
            { name: 'og:title', content: SITE_NAME },
            { name: 'og:type', content: 'website' },
            { name: 'og:url', content: pageUrl },
            { name: 'og:image', content: defaultOgImage },
            { name: 'og:image:secure_url', content: defaultOgImage },
            { name: 'og:image:type', content: 'image/png' },
            { name: 'og:image:alt', content: `${SITE_NAME} Cover` },
            { name: 'og:image:width', content: '1200' },
            { name: 'og:image:height', content: '630' },
            { name: 'og:description', content: SITE_DESCRIPTION },
            { name: 'og:site_name', content: SITE_NAME },
            { name: 'og:locale', content: 'en_CA' },

            // Author details
            { name: 'author', content: AUTHOR_NAME },
            { name: 'article:author', content: AUTHOR_URL },
            { name: 'article:author:name', content: AUTHOR_NAME },
            { name: 'article:publisher', content: `${AUTHOR_URL}/` },

            // Twitter Card metadata
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:site', content: TWITTER_HANDLE },
            { name: 'twitter:creator', content: TWITTER_HANDLE },
            { name: 'twitter:title', content: SITE_NAME },
            { name: 'twitter:description', content: SITE_DESCRIPTION },
            { name: 'twitter:image', content: defaultOgImage },
            { name: 'twitter:url', content: pageUrl },
        ],
        theme: cookieValue,
        navigation: SITE_NAVIGATION,
        socials: SITE_SOCIALS,
    };
};
