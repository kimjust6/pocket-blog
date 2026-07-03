const {
    COLLECTION_CONFIG_URL,
    COLLECTION_CALENDAR_URL,
    COLLECTION_ENDPOINT_HEADERS,
    DISCORD_MESSAGE_MAX_LENGTH,
    COLLECTION_TYPE_METADATA,
    COLLECTION_DAY_NAMES,
    WEEKDAY_INDEX,
} = require("./constants.js");

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

    const messageLines = [
        `**Waste Collection Schedule**`,
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

module.exports = {
    COLLECTION_CONFIG_URL,
    COLLECTION_CALENDAR_URL,
    COLLECTION_ENDPOINT_HEADERS,
    buildCollectionScheduleResponse,
    formatCollectionDiscordMessage,
    getHttpJson,
    getHttpText,
};
