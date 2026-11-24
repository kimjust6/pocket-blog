const {
    COLLECTION_CONFIG_URL,
    COLLECTION_CALENDAR_URL,
    COLLECTION_ENDPOINT_HEADERS,
    COLLECTION_TYPE_METADATA,
    COLLECTION_DAY_NAMES,
    WEEKDAY_INDEX,
    DISCORD_ID_JUSTIN,
    COLLECTION_ENDPOINT_BASE_URL,
    COLLECTION_SUGGEST_URL,
    POCKET_ADMIN_COLLECTION_ADDRESS,
} = require("./constants.js");
const { decodeHttpBody, getHttpJson } = require("./http.js");
const { getConfigValue } = require("./pocket.js");
const { sendDiscordMessage2 } = require("./discord.js");

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

function getHttpText(response) {
    return decodeHttpBody(response?.raw ?? response?.body);
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

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let closestDateStr = null;
    let minFutureDiff = Infinity;

    calendarData.collectionCalendar.forEach((event) => {
        if (!event?.start) return;
        const eventDate = parseIsoDate(event.start);
        const diff = eventDate.getTime() - today.getTime();
        if (diff >= 0 && diff < minFutureDiff) {
            minFutureDiff = diff;
            closestDateStr = event.start;
        }
    });

    if (!closestDateStr) {
        let minDiff = Infinity;
        calendarData.collectionCalendar.forEach((event) => {
            if (!event?.start) return;
            const eventDate = parseIsoDate(event.start);
            const diff = Math.abs(eventDate.getTime() - today.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                closestDateStr = event.start;
            }
        });
    }

    const filteredCalendar = calendarData.collectionCalendar.filter((event) => event.start === closestDateStr);

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
        nextPickup: filteredCalendar,
        collectionCalendar: filteredCalendar,
    };
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHumanDate(date) {
    const dayName = dayNames[date.getUTCDay()];
    const monthName = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${dayName}, ${monthName} ${day}, ${year}`;
}

function formatCollectionDiscordMessage(response) {
    const data = response?.json;
    if (!data) {
        return `Collection status: ${response?.statusCode ?? 'Unknown'}\nNo schedule data available.`;
    }

    const address = data.address || "Unknown Address";
    const areaDesc = data.collectionArea?.description || "";
    const pdfUrl = data.pdfUrl;
    const events = data.collectionCalendar || [];

    if (events.length === 0) {
        return `Waste Collection Schedule for **${address}**:\nNo upcoming pickups found in the calendar.`;
    }

    const dateStr = events[0].start;
    const dateObj = parseIsoDate(dateStr);
    const humanDate = formatHumanDate(dateObj);

    const items = events.map(event => `- ${event.title}`).join("\n");

    const hasGarbage = events.some(event => event.collectionType === "Garbage");
    const hasRecycling = events.some(event => event.collectionType === "Recycling");
    const scheduleTitle = hasGarbage
        ? "Garbage Collection Schedule"
        : hasRecycling
            ? "Recycle Collection Schedule"
            : "Waste Collection Schedule";

    const messageLines = [
        `**${scheduleTitle}**`,
        `**Address**: ${address}${areaDesc ? ` (${areaDesc})` : ""}`,
        `**Next Pickup Date**: ${humanDate}`,
        ``,
        `**Items to set out:**`,
        items
    ];

    if (pdfUrl) {
        messageLines.push(``, `[Download Schedule PDF](${pdfUrl})`);
    }

    return messageLines.join("\n");
}

/**
 * Resolve Toronto collection schedule, format data, and send Discord alert.
 * Invoked by /api/collection-schedule endpoint and by weekly native cron job.
 * @param {string} locationOverride
 * @returns {{ statusCode: number, json: Object }}
 */
function fetchAndNotifyCollectionSchedule(locationOverride = "", notifyFn = sendDiscordMessage2) {
    const buildEndpointFromKeyString = (keyString) => {
        return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&keyString=${encodeURIComponent(keyString)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const buildEndpointFromLocation = (location) => {
        return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&singleLine=${encodeURIComponent(location)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const sendHttpOrThrowLocal = (label, requestOptions) => {
        try {
            return $http.send(requestOptions);
        } catch (_) {
            throw new Error(`${label} request failed.`);
        }
    };

    let location = String(locationOverride || "").trim() || getConfigValue("COLLECTION_SCHEDULE_ADDRESS", POCKET_ADMIN_COLLECTION_ADDRESS);
    if (!location) {
        throw new Error("Collection schedule address is not configured.");
    }

    location = location
        .replace(/\bcourt\b/gi, "crt")
        .replace(/\bct\b/gi, "crt")
        .replace(/\bstreet\b/gi, "st")
        .replace(/\broad\b/gi, "rd")
        .replace(/\bavenue\b/gi, "ave")
        .replace(/\bdrive\b/gi, "dr")
        .replace(/\bboulevard\b/gi, "blvd")
        .replace(/\bplace\b/gi, "pl")
        .replace(/\bcrescent\b/gi, "cres");

    const suggestUrl = `${COLLECTION_SUGGEST_URL}?f=json&matchAddress=1&matchPlaceName=1&matchPostalCode=1&addressOnly=0&retRowLimit=100&searchString=${encodeURIComponent(location)}&filter=5`;
    const suggestResponse = sendHttpOrThrowLocal("Toronto suggest", {
        url: suggestUrl,
        headers: COLLECTION_ENDPOINT_HEADERS,
    });
    const suggestJson = getHttpJson(suggestResponse);
    const suggestRows = suggestJson?.result?.rows;

    let geocoderUrl = buildEndpointFromLocation(location);
    if (Array.isArray(suggestRows) && suggestRows.length > 0) {
        const keyString = suggestRows[0]?.KEYSTRING ?? suggestRows[0]?.keyString;
        if (keyString) {
            geocoderUrl = buildEndpointFromKeyString(String(keyString));
        }
    }

    const geocoderResponse = sendHttpOrThrowLocal("Toronto geocoder", {
        url: geocoderUrl,
        headers: COLLECTION_ENDPOINT_HEADERS,
    });
    const configResponse = sendHttpOrThrowLocal("Collection config", {
        url: COLLECTION_CONFIG_URL,
        headers: { Accept: "application/json" },
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

    if (typeof notifyFn === "function") {
        notifyFn(formatCollectionDiscordMessage(response), DISCORD_ID_JUSTIN);
    }

    return response;
}

module.exports = {
    COLLECTION_CONFIG_URL,
    COLLECTION_CALENDAR_URL,
    COLLECTION_ENDPOINT_HEADERS,
    buildCollectionScheduleResponse,
    formatCollectionDiscordMessage,
    fetchAndNotifyCollectionSchedule,
    parseIsoDate,
    formatIsoDate,
    parseCsv,
    buildCollectionEvent,
    getHttpJson,
    getHttpText,
};
