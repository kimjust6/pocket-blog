const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
    parseIsoDate,
    formatIsoDate,
    buildCollectionEvent,
    buildCollectionScheduleResponse,
    formatCollectionDiscordMessage,
    fetchAndNotifyCollectionSchedule,
} = require("../pb_hooks/pages/utils/collection.js");
const { DISCORD_ID_JUSTIN } = require("../pb_hooks/pages/utils/constants.js");

describe("Toronto garbage/waste collection", () => {
    const origHttp = global.$http;
    const origEnvAddr = process.env.COLLECTION_SCHEDULE_ADDRESS;

    afterEach(() => {
        if (origHttp === undefined) delete global.$http;
        else global.$http = origHttp;

        if (origEnvAddr === undefined) delete process.env.COLLECTION_SCHEDULE_ADDRESS;
        else process.env.COLLECTION_SCHEDULE_ADDRESS = origEnvAddr;
    });

    it("parses and formats ISO dates in UTC", () => {
        const d = parseIsoDate("2026-11-24");
        assert.equal(formatIsoDate(d), "2026-11-24");
    });

    it("builds collection events for valid weekday codes and ignores 0 or unknown codes", () => {
        const weekStart = parseIsoDate("2026-11-22"); // Sunday
        const tuesday = buildCollectionEvent(weekStart, "Garbage", "T");
        assert.deepEqual(tuesday, {
            collectionType: "Garbage",
            title: "Garbage",
            start: "2026-11-24",
            end: "2026-11-24",
            url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-garbage-bin/",
        });
        assert.equal(buildCollectionEvent(weekStart, "Garbage", "0"), null);
        assert.equal(buildCollectionEvent(weekStart, "Garbage", "X"), null);
    });

    it("throws when geocoder has no match or area is No Collection", () => {
        assert.throws(
            () => buildCollectionScheduleResponse({ json: { result: { rows: [] } } }, { json: {} }, { body: "" }),
            /No Toronto collection address match found/
        );
        assert.throws(
            () =>
                buildCollectionScheduleResponse(
                    {
                        json: {
                            result: {
                                rows: [{ AREACURSOR1: { array: [{ AREA_NAME: "None", AREA_DESC: "No Collection" }] } }],
                            },
                        },
                    },
                    { json: {} },
                    { body: "" }
                ),
            /No Toronto collection schedule available/
        );
    });

    it("selects the closest upcoming pickup date when multiple weeks exist", () => {
        const future1 = new Date(Date.now() + 2 * 86400000);
        const sunday1 = new Date(Date.UTC(future1.getUTCFullYear(), future1.getUTCMonth(), future1.getUTCDate() - future1.getUTCDay()));
        const sunday2 = new Date(sunday1.getTime() + 7 * 86400000);
        const s1 = formatIsoDate(sunday1);
        const s2 = formatIsoDate(sunday2);

        const csv = [
            "Calendar,WeekStarting,GreenBin,Garbage,Recycling",
            `Tuesday1,${s2},T,0,T`,
            `Tuesday1,${s1},T,T,0`,
        ].join("\n");

        const result = buildCollectionScheduleResponse(
            {
                json: {
                    result: {
                        rows: [
                            {
                                ADDRESS_FULL: "100 QUEEN ST W",
                                AREACURSOR1: { array: [{ AREA_NAME: "Tuesday 1", AREA_DESC: "Tuesday" }] },
                            },
                        ],
                    },
                },
            },
            { json: {} },
            { body: csv }
        );

        const expectedDate = formatIsoDate(new Date(sunday1.getTime() + 2 * 86400000));
        assert.equal(result.nextPickup.length, 2);
        assert.equal(result.nextPickup[0].start, expectedDate);
    });

    it("formats Discord messages for Garbage, Recycling, empty calendar, and missing JSON", () => {
        assert.match(formatCollectionDiscordMessage({ statusCode: 500 }), /Collection status: 500/);

        const emptyMsg = formatCollectionDiscordMessage({
            json: { address: "100 QUEEN ST W", collectionCalendar: [] },
        });
        assert.match(emptyMsg, /No upcoming pickups found/);

        const garbageMsg = formatCollectionDiscordMessage({
            json: {
                address: "100 QUEEN ST W",
                collectionArea: { description: "Tuesday" },
                pdfUrl: "https://example.com/cal.pdf",
                collectionCalendar: [
                    { collectionType: "Garbage", title: "Garbage", start: "2026-11-24" },
                    { collectionType: "GreenBin", title: "Green Bin", start: "2026-11-24" },
                ],
            },
        });
        assert.match(garbageMsg, /\*\*Garbage Collection Schedule\*\*/);
        assert.match(garbageMsg, /- Garbage\n- Green Bin/);
        assert.match(garbageMsg, /\[Download Schedule PDF\]\(https:\/\/example\.com\/cal\.pdf\)/);

        const recycleMsg = formatCollectionDiscordMessage({
            json: {
                address: "100 QUEEN ST W",
                collectionCalendar: [{ collectionType: "Recycling", title: "Recycling", start: "2026-11-24" }],
            },
        });
        assert.match(recycleMsg, /\*\*Recycle Collection Schedule\*\*/);
    });

    it("fetchAndNotifyCollectionSchedule normalizes street types, uses suggest keyString, and calls injected notifier", () => {
        const seenUrls = [];
        global.$http = {
            send({ url }) {
                seenUrls.push(url);
                if (url.includes("/suggest")) {
                    return { statusCode: 200, json: { result: { rows: [{ KEYSTRING: "KEY123" }] } } };
                }
                if (url.includes("/findAddressCandidates")) {
                    return {
                        statusCode: 200,
                        json: {
                            result: {
                                rows: [
                                    {
                                        ADDRESS_FULL: "10 MAIN ST",
                                        AREACURSOR1: { array: [{ AREA_NAME: "Tuesday 1", AREA_DESC: "Tuesday" }] },
                                    },
                                ],
                            },
                        },
                    };
                }
                if (url.includes("swm_collection_calendar_config")) {
                    return { statusCode: 200, json: { Tuesday1: "https://example.com/t1.pdf" } };
                }
                return { statusCode: 200, body: "Calendar,WeekStarting,GreenBin,Garbage\nTuesday1,2026-11-22,T,T\n" };
            },
        };

        const notified = [];
        const res = fetchAndNotifyCollectionSchedule("10 Main Street", (msg, userId) => {
            notified.push({ msg, userId });
        });

        assert.equal(res.statusCode, 200);
        assert.ok(seenUrls[0].includes("10%20Main%20st"));
        assert.ok(seenUrls[1].includes("keyString=KEY123"));
        assert.equal(notified.length, 1);
        assert.equal(notified[0].userId, DISCORD_ID_JUSTIN);
        assert.match(notified[0].msg, /10 MAIN ST/);
    });

    it("throws when collection address is not configured", () => {
        delete process.env.COLLECTION_SCHEDULE_ADDRESS;
        assert.throws(() => fetchAndNotifyCollectionSchedule("", () => {}), /not configured/);
    });
});
