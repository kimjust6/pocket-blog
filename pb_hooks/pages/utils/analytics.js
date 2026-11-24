const {
    GA_MEASUREMENT_ID,
    POCKET_ADMIN_GA_API_SECRET,
} = require("./constants.js");
const { getConfigValue } = require("./pocket.js");

/**
 * Sanitize search terms to prevent tracking sensitive data, credentials, URLs, or malicious payloads.
 * @param {string} term
 * @returns {string}
 */
function sanitizeSearchTerm(term) {
    if (!term || typeof term !== "string") return "";
    const clean = term.trim().replace(/<[^>]*>/g, "");
    if (/@|\b(https?|ftp|file):\/\/|password|token|secret/i.test(clean)) {
        return "";
    }
    return clean.slice(0, 100);
}

/**
 * Resolve the GA4 Measurement Protocol API secret from env or admin_settings.
 * @returns {string}
 */
function getGaApiSecret() {
    return getConfigValue("GA_API_SECRET", POCKET_ADMIN_GA_API_SECRET);
}

/**
 * Send an event to Google Analytics 4 Measurement Protocol from the server.
 * @param {string} eventName
 * @param {Object} eventParams
 * @param {Object|null} req
 */
function trackGAEvent(eventName, eventParams = {}, req = null) {
    try {
        const measurementId = GA_MEASUREMENT_ID || "G-6P8M4DJNQL";
        const apiSecret = getGaApiSecret();
        if (!apiSecret) {
            return;
        }

        let clientId = "pb_server_client";
        if (req) {
            try {
                let cookies = null;
                if (typeof req.cookies === "function") {
                    cookies = req.cookies();
                } else if (req.cookies) {
                    cookies = req.cookies;
                }
                if (cookies && cookies._ga) {
                    const gaVal = cookies._ga.value || cookies._ga;
                    const parts = String(gaVal).split(".");
                    if (parts.length >= 4) {
                        clientId = parts.slice(2).join(".");
                    }
                }
            } catch (_) {}
        }

        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
        const payload = {
            client_id: clientId,
            events: [
                {
                    name: eventName,
                    params: Object.assign({}, eventParams, {
                        anonymize_ip: true,
                        allow_google_signals: false,
                    }),
                },
            ],
        };

        const sendRequest = () => {
            try {
                if (typeof $http !== "undefined" && $http.send) {
                    $http.send({
                        url,
                        method: "POST",
                        body: JSON.stringify(payload),
                        timeout: 3,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });
                }
            } catch (err) {
                if (typeof $app !== "undefined" && $app.logger) {
                    $app.logger().error("Failed to send GA event from backend", "error", err);
                }
            }
        };

        if (typeof setTimeout === "function") {
            setTimeout(sendRequest, 0);
        } else {
            sendRequest();
        }
    } catch (err) {
        if (typeof $app !== "undefined" && $app.logger) {
            $app.logger().error("Failed to prepare GA event tracking", "error", err);
        }
    }
}

module.exports = {
    sanitizeSearchTerm,
    getGaApiSecret,
    trackGAEvent,
};
