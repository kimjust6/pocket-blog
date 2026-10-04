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
            {
                name: 'status-responder',
                fn: () => ({
                    name: 'status-responder',
                    onResponse: ({ content, api }) => {
                        const status = api.status || api.data?.status || 200;
                        api.response.html(status, content);
                        return true;
                    },
                }),
            },
        ],
        debug: true,
    }
}
