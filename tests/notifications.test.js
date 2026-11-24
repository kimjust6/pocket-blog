const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { verifyConfiguredSecret } = require("../pb_hooks/pages/utils/http.js");
const { sendDiscordMessage, sendDiscordMessage2 } = require("../pb_hooks/pages/utils/discord.js");
const {
    getAssigneeId,
    getActorId,
    getTicketType,
    getZendeskUrl,
    isJustinsTicket,
    isTicketCreated,
    privateIsStatusChangedEvent,
    generateNormalTicketMessage,
    generateSlaBreachingSoonMessage,
    processZendeskTicketEvent,
} = require("../pb_hooks/pages/utils/zendesk.js");
const { ZENDESK_ASSIGNEE_ID_JUSTIN, DISCORD_ID_JUSTIN } = require("../pb_hooks/pages/utils/constants.js");

describe("webhook secret verification", () => {
    const envKey = "TEST_WEBHOOK_SECRET_UNIT";

    afterEach(() => {
        delete process.env[envKey];
    });

    it("fails closed when no secret is configured", () => {
        const res = verifyConfiguredSecret({ requestInfo: () => ({ headers: {} }) }, envKey, "");
        assert.deepEqual(res, { configured: false, authorized: false });
    });

    it("authorizes matching custom header or Bearer token and rejects mismatches", () => {
        process.env[envKey] = "top-secret";

        assert.deepEqual(
            verifyConfiguredSecret(
                { requestInfo: () => ({ headers: { "x-webhook-secret": "top-secret" } }) },
                envKey,
                "",
                ["X-Webhook-Secret"]
            ),
            { configured: true, authorized: true }
        );

        assert.deepEqual(
            verifyConfiguredSecret(
                { requestInfo: () => ({ headers: { Authorization: "Bearer top-secret" } }) },
                envKey,
                ""
            ),
            { configured: true, authorized: true }
        );

        assert.deepEqual(
            verifyConfiguredSecret(
                { requestInfo: () => ({ headers: { "x-webhook-secret": "wrong" } }) },
                envKey,
                ""
            ),
            { configured: true, authorized: false }
        );
    });
});

describe("Discord messaging", () => {
    const origHttp = global.$http;
    const origApp = global.$app;
    const origToken = process.env.DISCORD_BOT_TOKEN;

    afterEach(() => {
        if (origHttp === undefined) delete global.$http;
        else global.$http = origHttp;

        if (origApp === undefined) delete global.$app;
        else global.$app = origApp;

        if (origToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
        else process.env.DISCORD_BOT_TOKEN = origToken;
    });

    it("returns error when bot token is missing", () => {
        delete process.env.DISCORD_BOT_TOKEN;
        const res = sendDiscordMessage("hello", "123");
        assert.equal(res.ok, false);
        assert.match(res.error, /Missing Discord bot token/);
    });

    it("handles Discord 401/403/429 errors and successful DM delivery", () => {
        process.env.DISCORD_BOT_TOKEN = "bot-token";

        global.$http = {
            send: () => ({ status: 403, body: "{}" }),
        };
        const forbidden = sendDiscordMessage("hi", "123");
        assert.equal(forbidden.ok, false);
        assert.match(forbidden.error, /forbidden/);

        let step = 0;
        global.$http = {
            send: ({ url }) => {
                step++;
                if (step === 1) {
                    assert.match(url, /\/users\/@me\/channels$/);
                    return { status: 200, body: JSON.stringify({ id: "dm_1" }) };
                }
                assert.match(url, /\/channels\/dm_1\/messages$/);
                return { status: 200, body: JSON.stringify({ id: "msg_1" }) };
            },
        };
        const ok = sendDiscordMessage("hi", "123");
        assert.equal(ok.ok, true);
        assert.equal(ok.channel.id, "dm_1");
        assert.equal(ok.message.id, "msg_1");
    });

    it("falls back to direct Discord send when proxy returns non-200", () => {
        process.env.DISCORD_BOT_TOKEN = "bot-token";
        global.$app = { logger: () => ({ info() {}, warn() {}, error() {} }) };

        const calls = [];
        global.$http = {
            send: ({ url }) => {
                calls.push(url);
                if (url.includes("zen.jkim.win")) return { status: 502, body: "bad gateway" };
                if (url.includes("@me/channels")) return { status: 200, body: JSON.stringify({ id: "dm_2" }) };
                return { status: 200, body: JSON.stringify({ id: "msg_2" }) };
            },
        };

        sendDiscordMessage2("hello", "123");
        assert.equal(calls.length, 3);
    });
});

describe("Zendesk helpers", () => {
    it("extracts ticket fields, checks ownership/event types, and formats messages", () => {
        const createdPayload = {
            type: "zen:event-type:ticket.created",
            detail: {
                id: 99,
                subject: "Login broken",
                assignee_id: ZENDESK_ASSIGNEE_ID_JUSTIN,
                actor_id: "111",
            },
        };

        assert.equal(getAssigneeId(createdPayload), ZENDESK_ASSIGNEE_ID_JUSTIN);
        assert.equal(getActorId(createdPayload), "111");
        assert.equal(getTicketType(createdPayload), "zen:event-type:ticket.created");
        assert.equal(getZendeskUrl(createdPayload), "https://yaksa.zendesk.com/agent/tickets/99");
        assert.equal(isJustinsTicket(createdPayload), true);
        assert.equal(isTicketCreated(createdPayload), true);
        assert.equal(privateIsStatusChangedEvent(createdPayload), false);

        assert.equal(
            generateNormalTicketMessage(createdPayload),
            " Updated | 99: [Login broken](https://yaksa.zendesk.com/agent/tickets/99)"
        );
        assert.equal(
            generateSlaBreachingSoonMessage(createdPayload),
            " Check SLA | 99: [Login broken](https://yaksa.zendesk.com/agent/tickets/99)"
        );
    });

    it("routes ticket created, SLA breach, and normal updates via processZendeskTicketEvent", () => {
        const origApp = global.$app;
        global.$app = {
            logger: () => ({ info() {}, warn() {}, error() {} }),
            findRecordsByFilter: () => [{ get: () => "discord_assignee_1" }],
            recordQuery: () => ({ andWhere() { return this; }, limit() { return this; }, one() {} }),
        };

        try {
            const sent = [];
            const mockNotify = (msg, userId) => sent.push({ msg, userId });

            // 1. Ticket created
            processZendeskTicketEvent(
                { type: "zen:event-type:ticket.created", detail: { id: 10, subject: "New bug" } },
                new Date(),
                { sendDiscordMessage: mockNotify }
            );
            assert.equal(sent.length, 1);
            assert.match(sent[0].msg, /^New Ticket: /);

            // 2. SLA breaching notifies assignee and Justin when different
            sent.length = 0;
            processZendeskTicketEvent(
                {
                    detail: { id: 11, subject: "SLA soon", assignee_id: "999" },
                    event: { tags_added: ["nearing_sla_breach_notified"] },
                },
                new Date(),
                { sendDiscordMessage: mockNotify }
            );
            assert.equal(sent.length, 2);
            assert.equal(sent[0].userId, "discord_assignee_1");
            assert.equal(sent[1].userId, undefined);

            // 3. Normal update skips when actor === assignee or ticket is closed
            sent.length = 0;
            processZendeskTicketEvent(
                { detail: { id: 12, subject: "Self update", assignee_id: "5", actor_id: "5" } },
                new Date(),
                { sendDiscordMessage: mockNotify, getAdminSetting: () => "10", findRecentTickets: () => [] }
            );
            assert.equal(sent.length, 0);

            processZendeskTicketEvent(
                {
                    type: "zen:event-type:ticket.status_changed",
                    detail: { id: 13, subject: "Closed", status: "CLOSED", assignee_id: "5", actor_id: "6" },
                },
                new Date(),
                { sendDiscordMessage: mockNotify, getAdminSetting: () => "10", findRecentTickets: () => [] }
            );
            assert.equal(sent.length, 0);

            // 4. Normal update sends when actor !== assignee and not duplicate
            processZendeskTicketEvent(
                { detail: { id: 14, subject: "Customer reply", assignee_id: "5", actor_id: "6" } },
                new Date(),
                { sendDiscordMessage: mockNotify, getAdminSetting: () => "10", findRecentTickets: () => [] }
            );
            assert.equal(sent.length, 1);
            assert.equal(sent[0].userId, "discord_assignee_1");
            assert.match(sent[0].msg, /Customer reply/);
            assert.ok(DISCORD_ID_JUSTIN);
        } finally {
            if (origApp === undefined) delete global.$app;
            else global.$app = origApp;
        }
    });
});
