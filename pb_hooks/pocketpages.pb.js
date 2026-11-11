require('pocketpages')

// General 404 handler for routes that do not resolve to any valid page
routerUse((e) => {
    // Decide whether this request should be rendered as a 404 page. e.next() must be
    // called OUTSIDE the try/catch: errors thrown by downstream handlers (e.g. PocketBase's
    // own 404 for /api/files) would otherwise be swallowed and re-run, producing empty 200s.
    let render404 = false;
    try {
        const method = (e.request?.method || "").toUpperCase();
        const cleanPath = String(e.request?.url?.path || "").replace(/^\/+/, "");

        if (
            (method === "GET" || method === "HEAD") &&
            // PocketBase admin dashboard, API routes and clippy webhooks
            cleanPath !== "_" &&
            !cleanPath.startsWith("_/") &&
            !cleanPath.startsWith("api/") &&
            !cleanPath.startsWith("clippy/")
        ) {
            render404 = true;
            // Static files in pb_public pass through if they exist
            if (cleanPath) {
                try {
                    const publicFilePath = $filepath.join(__hooks, "../pb_public", cleanPath);
                    if ($os.stat(publicFilePath)) render404 = false;
                } catch (_) {
                    // File does not exist in pb_public
                }
            }
        }
    } catch (err) {
        try {
            $app.logger().error("Error handling 404 route", "error", err);
        } catch (_) { }
        render404 = false;
    }

    if (!render404) {
        return e.next();
    }

    const customEvent = Object.create(e);
    customEvent.request = {
        method: e.request?.method || "GET",
        url: {
            string: () => "/pagenotfound",
        },
        header: e.request?.header,
    };

    require("pocketpages").MiddlewareHandler(customEvent);
});
