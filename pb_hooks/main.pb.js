/// <reference path="../pb_data/types.d.ts" />

const COLLECTION_ENDPOINT_BASE_URL = "https://map.toronto.ca/cotgeocoder/rest/geocoder/findAddressCandidates";
const COLLECTION_SUGGEST_URL = "https://map.toronto.ca/cotgeocoder/rest/geocoder/suggest";
const DEFAULT_COLLECTION_KEY_STRING = "ADDRESS:geoid:546720:rowid:367935";
const COLLECTION_ENDPOINT_HEADERS = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.7",
    Origin: "https://www.toronto.ca",
    Referer: "https://www.toronto.ca/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
};

const DISCORD_MESSAGE_MAX_LENGTH = 1900;
const COLLECTION_TYPE_METADATA = {
    GreenBin: {
        title: "Green Bin",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-green-bin/",
    },
    Garbage: {
        title: "Garbage",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-garbage-bin/",
    },
    Recycling: {
        title: "Recycling",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-blue-bin/",
    },
    YardWaste: {
        title: "Yard Waste",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/yard-waste/",
    },
    ChristmasTree: {
        title: "Christmas Tree",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/yard-waste/",
    },
};
const COLLECTION_DAY_NAMES = {
    M: "Monday",
    T: "Tuesday",
    W: "Wednesday",
    R: "Thursday",
    F: "Friday",
    S: "Saturday",
    0: "No pick-up",
};
const WEEKDAY_INDEX = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
};

function parseIsoDate(dateString) {
    const [year, month, day] = dateString.split("-").map((value) => parseInt(value, 10));
    return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
    const nextDate = new Date(date.getTime());
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function getWeekStart(date) {
    return addUtcDays(date, -date.getUTCDay());
}

function getWeekEnd(date) {
    return addUtcDays(getWeekStart(date), 6);
}

function parseCsv(csvText) {
    const normalizedCsv = typeof csvText === "string" ? csvText : String(csvText ?? "");
    if (!normalizedCsv.trim()) {
        return [];
    }

    const lines = normalizedCsv.trim().split(/\r\n|\r|\n/g);
    const headers = lines.shift().split(",").map((value) => value.trim());

    return lines
        .filter((line) => line.trim())
        .map((line) => {
            const values = line.split(",");
            const row = {};
            headers.forEach((header, index) => {
                row[header] = (values[index] ?? "").trim();
            });
            return row;
        });
}

function decodeHttpBody(rawBody) {
    if (rawBody == null) {
        return "";
    }

    if (typeof rawBody === "string") {
        return rawBody;
    }

    if (typeof TextDecoder !== "undefined" && rawBody instanceof Uint8Array) {
        try {
            return new TextDecoder().decode(rawBody);
        } catch (_) {
            return String(rawBody);
        }
    }

    if (Array.isArray(rawBody)) {
        try {
            if (typeof TextDecoder !== "undefined") {
                return new TextDecoder().decode(Uint8Array.from(rawBody));
            }
        } catch (_) {
            return rawBody.map((value) => String.fromCharCode(value)).join("");
        }
        return rawBody.map((value) => String.fromCharCode(value)).join("");
    }

    return String(rawBody);
}

function getHttpJson(response) {
    if (response?.json && typeof response.json === "object") {
        return response.json;
    }

    const payload = decodeHttpBody(response?.raw ?? response?.body);
    if (!payload.trim()) {
        return null;
    }

    try {
        return JSON.parse(payload);
    } catch (_) {
        return null;
    }
}

function getHttpText(response) {
    return decodeHttpBody(response?.raw ?? response?.body);
}

globalThis.getHttpJson = getHttpJson;

function sendHttpOrThrow(label, requestOptions) {
    try {
        return $http.send(requestOptions);
    } catch (_) {
        throw new Error(`${label} request failed.`);
    }
}

function buildCollectionEvent(weekStarting, collectionKey, collectionCode) {
    if (!collectionCode || collectionCode === "0") {
        return null;
    }

    const weekdayName = COLLECTION_DAY_NAMES[collectionCode];
    const weekdayIndex = WEEKDAY_INDEX[weekdayName];
    if (weekdayIndex == null) {
        return null;
    }

    const eventDate = addUtcDays(getWeekStart(weekStarting), weekdayIndex);
    const metadata = COLLECTION_TYPE_METADATA[collectionKey];

    return {
        collectionType: collectionKey,
        title: metadata.title,
        start: formatIsoDate(eventDate),
        end: formatIsoDate(eventDate),
        url: metadata.url,
    };
}

function buildCollectionCalendar(areaName, csvRows) {
    const nextPickupByArea = {};
    const collectionCalendarByArea = {};
    const areaDayName = areaName.replace(/\d/g, "");
    const areaWeekdayIndex = WEEKDAY_INDEX[areaDayName] ?? 0;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const pickupReferenceDate = today.getUTCDay() < areaWeekdayIndex
        ? today
        : addUtcDays(today, 7);
    const nextPickupWeekStart = getWeekStart(pickupReferenceDate);
    const nextPickupWeekEnd = getWeekEnd(pickupReferenceDate);

    csvRows.forEach((row) => {
        const weekStarting = parseIsoDate(row.WeekStarting);
        const events = Object.keys(COLLECTION_TYPE_METADATA)
            .map((collectionKey) => buildCollectionEvent(weekStarting, collectionKey, row[collectionKey]))
            .filter(Boolean);

        if (!collectionCalendarByArea[row.Calendar]) {
            collectionCalendarByArea[row.Calendar] = [];
        }
        collectionCalendarByArea[row.Calendar].push(...events);

        events.forEach((event) => {
            const eventDate = parseIsoDate(event.start);
            if (eventDate >= nextPickupWeekStart && eventDate <= nextPickupWeekEnd) {
                if (!nextPickupByArea[row.Calendar]) {
                    nextPickupByArea[row.Calendar] = [];
                }
                nextPickupByArea[row.Calendar].push(event);
            }
        });
    });

    return {
        nextPickup: nextPickupByArea[areaName] ?? [],
        collectionCalendar: collectionCalendarByArea[areaName] ?? [],
        allCollectionCalendars: collectionCalendarByArea,
    };
}

function extractGeocoderRow(geocoderResponse) {
    const geocoderJson = getHttpJson(geocoderResponse);

    if (!geocoderJson) {
        return null;
    }

    if (Array.isArray(geocoderJson?.result?.rows) && geocoderJson.result.rows.length > 0) {
        return geocoderJson.result.rows[0];
    }

    if (Array.isArray(geocoderJson) && geocoderJson.length > 0) {
        return geocoderJson[0];
    }

    if (geocoderJson.ADDRESS_FULL || geocoderJson.AREACURSOR1) {
        return geocoderJson;
    }

    return null;
}

function buildCollectionScheduleResponse(geocoderResponse, configResponse, calendarCsvResponse) {
    const geocoderRow = extractGeocoderRow(geocoderResponse);
    if (!geocoderRow) {
        throw new Error("No Toronto collection address match found.");
    }

    const collectionArea = geocoderRow.AREACURSOR1?.array?.find((area) => area?.AREA_NAME) ?? null;
    if (!collectionArea || collectionArea.AREA_DESC === "No Collection") {
        throw new Error("No Toronto collection schedule available for this address.");
    }

    const calendarData = buildCollectionCalendar(
        collectionArea.AREA_NAME.replace(/\s+/g, ""),
        parseCsv(getHttpText(calendarCsvResponse)),
    );
    const normalizedAreaName = collectionArea.AREA_NAME.replace(/\s+/g, "");
    const config = getHttpJson(configResponse) ?? {};

    return {
        address: geocoderRow.ADDRESS_FULL,
        ward: geocoderRow.WARD,
        postalCode: geocoderRow.POSTAL_CODE,
        coordinates: {
            latitude: geocoderRow.LATITUDE,
            longitude: geocoderRow.LONGITUDE,
        },
        collectionArea: {
            name: normalizedAreaName,
            description: collectionArea.AREA_DESC,
            shortCode: collectionArea.AREA_SHORT_CODE,
            type: collectionArea.AREA_TYPE,
        },
        pdfUrl: config[normalizedAreaName] ?? null,
        nextPickup: calendarData.nextPickup,
        collectionCalendar: calendarData.collectionCalendar,
    };
}

globalThis.buildCollectionScheduleResponse = buildCollectionScheduleResponse;

function formatCollectionDiscordMessage(response) {
    const payload = response.json ?? response.raw ?? "";
    const payloadText = typeof payload === "string"
        ? payload
        : JSON.stringify(payload, null, 2);
    const message = [
        `Collection status: ${response.statusCode}`,
        payloadText,
    ].join("\n\n");

    return message.length > DISCORD_MESSAGE_MAX_LENGTH
        ? `${message.slice(0, DISCORD_MESSAGE_MAX_LENGTH - 3)}...`
        : message;
}

function buildCollectionEndpointUrl(keyString) {
    return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&keyString=${encodeURIComponent(keyString)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
}

function buildCollectionEndpointUrlFromLocation(location) {
    return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&singleLine=${encodeURIComponent(location)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
}

function getQueryValue(requestInfo, key) {
    const query = requestInfo?.query;
    if (!query) {
        return "";
    }

    if (typeof query.get === "function") {
        return String(query.get(key) ?? "").trim();
    }

    return String(query[key] ?? "").trim();
}

function resolveCollectionEndpointUrl(requestInfo) {
    const explicitKeyString = getQueryValue(requestInfo, "keyString");
    if (explicitKeyString) {
        return buildCollectionEndpointUrl(explicitKeyString);
    }

    const location = getQueryValue(requestInfo, "location") || getQueryValue(requestInfo, "address");
    if (!location) {
        return buildCollectionEndpointUrl(DEFAULT_COLLECTION_KEY_STRING);
    }

    const suggestUrl = `${COLLECTION_SUGGEST_URL}?f=json&matchAddress=1&matchPlaceName=1&matchPostalCode=1&addressOnly=0&retRowLimit=100&searchString=${encodeURIComponent(location)}&filter=5`;
    const suggestResponse = sendHttpOrThrow("Toronto suggest", {
        url: suggestUrl,
        headers: COLLECTION_ENDPOINT_HEADERS,
    });
    const suggestJson = getHttpJson(suggestResponse);
    const suggestRows = suggestJson?.result?.rows;
    if (Array.isArray(suggestRows) && suggestRows.length > 0) {
        const keyString = suggestRows[0]?.KEYSTRING ?? suggestRows[0]?.keyString;
        if (keyString) {
            return buildCollectionEndpointUrl(String(keyString));
        }
    }

    return buildCollectionEndpointUrlFromLocation(location);
}

routerAdd("GET", "/api/collection-schedule", (e) => {
    const {
        COLLECTION_CONFIG_URL,
        COLLECTION_CALENDAR_URL,
        COLLECTION_ENDPOINT_HEADERS,
        buildCollectionScheduleResponse,
        formatCollectionDiscordMessage,
    } = require(`${__hooks}/pages/utils/collection.js`);

    const geocoderBaseUrl = "https://map.toronto.ca/cotgeocoder/rest/geocoder/findAddressCandidates";
    const suggestUrlBase = "https://map.toronto.ca/cotgeocoder/rest/geocoder/suggest";
    const defaultKeyString = "ADDRESS:geoid:546720:rowid:367935";

    const buildEndpointFromKeyString = (keyString) => {
        return `${geocoderBaseUrl}?f=json&keyString=${encodeURIComponent(keyString)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const buildEndpointFromLocation = (location) => {
        return `${geocoderBaseUrl}?f=json&singleLine=${encodeURIComponent(location)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const sendHttpOrThrowLocal = (label, requestOptions) => {
        try {
            return $http.send(requestOptions);
        } catch (_) {
            throw new Error(`${label} request failed.`);
        }
    };

    const getHttpJsonLocal = (response) => {
        if (response?.json && typeof response.json === "object") {
            return response.json;
        }

        const rawBody = response?.raw ?? response?.body;
        const payload = typeof rawBody === "string" ? rawBody : String(rawBody ?? "");
        if (!payload.trim()) {
            return null;
        }

        try {
            return JSON.parse(payload);
        } catch (_) {
            return null;
        }
    };

    const {
        sendDiscordMessage2,
    } = require(`${__hooks}/pages/utils/common.js`);
    const {
        DISCORD_ID_JUSTIN,
    } = require(`${__hooks}/pages/utils/constants.js`);

    try {
        const requestInfo = e.requestInfo();

        const arcgisResponse = sendHttpOrThrowLocal("ArcGIS Style", {
            url: "https://www.arcgis.com/sharing/rest/content/items/8a2cba3b0ebf4140b7c0dc5ee149549a/resources/styles/root.json?f=json",
            method: "GET",
            headers: {
                "sec-ch-ua-platform": '"Windows"',
                "Referer": "https://www.toronto.ca/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
                "sec-ch-ua": '"Brave";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
            },
        });
        const arcgisRaw = arcgisResponse?.raw ?? arcgisResponse?.body;
        const arcgisText = typeof arcgisRaw === "string" ? arcgisRaw : String(arcgisRaw ?? "");
        const arcgisDiscordMsg = [
            `ArcGIS status: ${arcgisResponse.statusCode}`,
            arcgisText.length > 1800 ? arcgisText.slice(0, 1800) + "..." : arcgisText,
        ].join("\n\n");
        sendDiscordMessage2(arcgisDiscordMsg, DISCORD_ID_JUSTIN);



        const resolveCollectionEndpointUrlLocal = (requestInfoArg) => {
            const query = requestInfoArg?.query;
            const readQuery = (key) => {
                if (!query) {
                    return "";
                }
                if (typeof query.get === "function") {
                    return String(query.get(key) ?? "").trim();
                }
                return String(query[key] ?? "").trim();
            };

            const explicitKeyString = readQuery("keyString");
            if (explicitKeyString) {
                return buildEndpointFromKeyString(explicitKeyString);
            }

            const location = readQuery("location") || readQuery("address");
            if (!location) {
                return buildEndpointFromKeyString(defaultKeyString);
            }

            const suggestUrl = `${suggestUrlBase}?f=json&matchAddress=1&matchPlaceName=1&matchPostalCode=1&addressOnly=0&retRowLimit=100&searchString=${encodeURIComponent(location)}&filter=5`;
            const suggestResponse = sendHttpOrThrowLocal("Toronto suggest", {
                url: suggestUrl,
                headers: COLLECTION_ENDPOINT_HEADERS,
            });
            const suggestJson = getHttpJsonLocal(suggestResponse);
            const suggestRows = suggestJson?.result?.rows;
            if (Array.isArray(suggestRows) && suggestRows.length > 0) {
                const keyString = suggestRows[0]?.KEYSTRING ?? suggestRows[0]?.keyString;
                if (keyString) {
                    return buildEndpointFromKeyString(String(keyString));
                }
            }

            return buildEndpointFromLocation(location);
        };

        const geocoderUrl = resolveCollectionEndpointUrlLocal(requestInfo);
        const geocoderResponse = sendHttpOrThrowLocal("Toronto geocoder", {
            url: geocoderUrl,
            headers: COLLECTION_ENDPOINT_HEADERS,
        });
        const configResponse = sendHttpOrThrowLocal("Collection config", {
            url: COLLECTION_CONFIG_URL,
            headers: {
                Accept: "application/json",
            },
        });
        const calendarCsvResponse = sendHttpOrThrowLocal("Collection calendar", {
            url: COLLECTION_CALENDAR_URL,
        });
        const scheduleResponse = buildCollectionScheduleResponse(
            geocoderResponse,
            configResponse,
            calendarCsvResponse,
        );
        const response = {
            statusCode: geocoderResponse.statusCode,
            json: scheduleResponse,
        };

        sendDiscordMessage2(formatCollectionDiscordMessage(response), DISCORD_ID_JUSTIN);

        return e.json(response.statusCode, {
            status: response.statusCode,
            data: response.json ?? response.raw,
        });
    } catch (err) {
        $app.logger().error("Failed to check collection endpoint", "error", err);
        sendDiscordMessage2([
            "Collection status: 502",
            err?.message ?? String(err),
        ].join("\n\n"), DISCORD_ID_JUSTIN);

        return e.json(502, {
            message: "Failed to check collection endpoint.",
            error: err?.message ?? String(err),
        });
    }
});

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        saveZendeskRecord,
    } = require(`${__hooks}/pages/utils/common.js`);

    let data;
    try {
        data = e.requestInfo();
    } catch (err) {
        $app.logger().error("Failed to parse request info", "error", err);
        return e.json(400, { message: "Invalid request" });
    }

    try {
        saveZendeskRecord(data);
    } catch (err) {
        $app.logger().error("Error saving Zendesk record", "error", err);
    }

    return e.json(202, { status: "accepted" });

});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})

// Hook for when a new zendesk_tickets record is created
onRecordAfterCreateSuccess((e) => {
    const {
        getAssigneeId,
        getActorId,
        sendDiscordMessage,
        findRecentTicketsByTicketNumber2,
        getAdminSetting,
        generateNormalTicketMessage,
        isTicketClosed,
        isSlaBreaching,
        getDiscordIdfromData,
        generateSlaBreachingSoonMessage,
        isTicketCreated,
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS,
        DISCORD_ID_JUSTIN
    } = require(`${__hooks}/pages/utils/constants.js`);

    function handleTicketCreated(data) {
        const myMessage = generateNormalTicketMessage(data);
        sendDiscordMessage(`New Ticket: ${myMessage}`);
    }

    function handleSendMessage(data, createdDate = new Date()) {
        const discordId = getDiscordIdfromData(data);
        if (!discordId) {
            return;
        }

        try {
            const settingRaw = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
            const appsettingsDelaySeconds = parseInt(settingRaw, 10);
            const timeInSeconds = isNaN(appsettingsDelaySeconds) ? 10 : appsettingsDelaySeconds;

            const actorId = getActorId(data);
            const assigneeId = getAssigneeId(data);
            const recentTickets = findRecentTicketsByTicketNumber2(data, timeInSeconds, actorId);

            // Check if there are no recent tickets
            if (actorId === assigneeId || isTicketClosed(data)) {
                return;
            }

            if (recentTickets.length > 1 && new Date(recentTickets[0]?.get("created")) < createdDate) {
                return;
            }

            const myMessage = generateNormalTicketMessage(data);
            sendDiscordMessage(myMessage, discordId);
        } catch (error) {
            $app.logger().error(`Error sending ticket update message: ${myMessage}.`, "error", error);
        }
    }

    function handleSLABreaching(data) {
        const discordId = getDiscordIdfromData(data);
        const myMessage = generateSlaBreachingSoonMessage(data);
        if (discordId) {
            sendDiscordMessage(myMessage, discordId);
        }

        if (discordId !== DISCORD_ID_JUSTIN) {
            sendDiscordMessage(myMessage);
        }
    }

    // Get the data field and convert to string
    const data = JSON.parse(e.record.get("data"));
    if (!data) {
        $app.logger().error(`No Data in PocketBase:`, "error");
        return;
    }

    if (isTicketCreated(data)) {
        handleTicketCreated(data);
    }
    else if (isSlaBreaching(data)) {
        handleSLABreaching(data);
    }
    else {
        handleSendMessage(data, new Date(e.record.get("created")));
    }

}, "zendesk_tickets")