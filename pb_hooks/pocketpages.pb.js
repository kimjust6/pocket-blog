require('pocketpages')

// General 404 handler for routes that do not resolve to any valid page
routerUse((e) => {
    try {
        const method = (e.request?.method || "").toUpperCase();
        if (method !== "GET" && method !== "HEAD") {
            return e.next();
        }

        const rawPath = String(e.request?.url?.path || "");
        const cleanPath = rawPath.replace(/^\/+/, "");

        // 1. Pass through PocketBase admin dashboard
        if (cleanPath === "_" || cleanPath.startsWith("_/")) {
            return e.next();
        }

        // 2. Pass through PocketBase API routes and clippy webhooks
        if (cleanPath.startsWith("api/") || cleanPath.startsWith("clippy/")) {
            return e.next();
        }

        // 3. Pass through static files in pb_public (if the file exists)
        if (cleanPath) {
            try {
                const publicFilePath = $filepath.join(__hooks, "../pb_public", cleanPath);
                const stat = $os.stat(publicFilePath);
                if (stat) {
                    return e.next();
                }
            } catch (_) {
                // File does not exist in pb_public
            }
        }

        // 4. Any remaining unmatched GET request is an invalid page -> render 404
        const customEvent = Object.create(e);
        customEvent.request = {
            method: e.request?.method || "GET",
            url: {
                string: () => "/pagenotfound",
            },
            header: e.request?.header,
        };

        require("pocketpages").MiddlewareHandler(customEvent);
    } catch (err) {
        try {
            $app.logger().error("Error handling 404 route", "error", err);
        } catch (_) {}
        return e.next();
    }
});
