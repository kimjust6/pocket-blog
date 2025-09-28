module.exports = function (api) {
    return {
        plugins: [
            {
                name: 'pocketpages-plugin-js-sdk',
                options: {
                    // Use the regular SDK instead of JSVM
                    sdk: 'pocketbase',
                },
            },
            'pocketpages-plugin-ejs',
        ],
        debug: false,
    }
}
