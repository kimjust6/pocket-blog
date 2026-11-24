const {
    POCKET_SLA_BREACHING_SOON,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    POCKET_COLLECTION_ZENDESK_TICKETS,
    POCKET_ZENDESKUSER_DISCORDUSER,
    POCKET_COLLECTION_ZENDESK_ORGANIZATIONS,
    ZENDESK_STATUS_CHANGED_TYPE,
    ZENDESK_CLOSED_STATUS,
    ZENDESK_TICKET_CREATED,
} = require("./constants.js");

/**
 * Unwrap webhook or stored Zendesk event body shapes.
 * @param {Object} data
 * @returns {Object|null}
 */
function privateGetBody(data) {
    if (data?.body?.body) return data.body.body;
    if (data?.body) return data.body;
    if (data?.detail) return data;
    return data ?? null;
}

/**
 * @param {Object} data
 * @returns {boolean}
 */
function privateIsStatusChangedEvent(data) {
    const body = privateGetBody(data);
    return body?.type === ZENDESK_STATUS_CHANGED_TYPE;
}

function isTicketClosed(data) {
    const body = privateGetBody(data);
    return privateIsStatusChangedEvent(data) && body?.detail?.status === ZENDESK_CLOSED_STATUS;
}

/**
 * @param {Object} data
 * @returns {number}
 */
function getTicketId(data) {
    const body = privateGetBody(data);
    let ticketId = body?.detail?.id ?? body?.id ?? body?.subject ?? "0";

    if (typeof ticketId === "number") {
        return ticketId;
    }

    if (typeof ticketId === "string") {
        ticketId = ticketId.split(":").pop().trim();
    }

    return parseInt(ticketId, 10) || 0;
}

/**
 * @param {Object} data
 * @returns {string|null}
 */
function getTicketTitle(data) {
    const body = privateGetBody(data);
    return body?.detail?.subject ?? body?.subject ?? null;
}

/**
 * @param {Object} data
 * @returns {string|null}
 */
function getTicketType(data) {
    const body = privateGetBody(data);
    return body?.type ?? body?.detail?.type ?? null;
}

/**
 * @param {Object} data
 * @param {string} assignee_id
 * @returns {boolean}
 */
function isJustinsTicket(data, assignee_id = ZENDESK_ASSIGNEE_ID_JUSTIN) {
    const body = privateGetBody(data);
    return body?.detail?.assignee_id === assignee_id;
}

/**
 * @param {Object} data
 * @returns {string|null}
 */
function getAssigneeId(data) {
    const body = privateGetBody(data);
    return body?.detail?.assignee_id ?? body?.assignee_id ?? null;
}

/**
 * @param {Object} data
 * @returns {string|null}
 */
function getActorId(data) {
    const body = privateGetBody(data);
    return body?.detail?.actor_id ?? body?.actor_id ?? null;
}

/**
 * @param {Object} ticket
 * @returns {boolean}
 */
function isSlaBreaching(ticket) {
    const body = privateGetBody(ticket);
    const tagsAdded = body?.event?.tags_added ?? body?.tags_added ?? [];
    return Array.isArray(tagsAdded) && tagsAdded.includes(POCKET_SLA_BREACHING_SOON);
}

/**
 * @param {Object} data
 * @returns {string|null}
 */
function getZendeskUrl(data) {
    const ticketId = getTicketId(data);
    if (!ticketId) {
        return null;
    }
    return `${ZENDESK_API_ENDPOINT}${ticketId}`;
}

/**
 * Persist an incoming Zendesk webhook payload to PocketBase.
 * @param {Object} data
 */
function saveZendeskRecord(data) {
    if (!data) {
        throw new Error("Invalid collection or data");
    }

    const collection = $app.findCollectionByNameOrId(POCKET_COLLECTION_ZENDESK_TICKETS);
    if (!collection) {
        throw new Error("zendesk_tickets collection not found");
    }

    const assigneeId = parseInt(getAssigneeId(data) ?? "0", 10);
    const actorId = parseInt(getActorId(data) ?? "0", 10);

    const record = new Record(collection);
    record.set("data", JSON.stringify(data));
    record.set("ticketId", getTicketId(data));
    record.set("ticketType", getTicketType(data));
    record.set("zendeskUserId", assigneeId);
    record.set("zendeskActorId", actorId);
    record.set("created", Date.now());
    record.set("updated", Date.now());

    $app.save(record);
}

/**
 * Find recent ticket events by Zendesk ticketId and optional actorId using PocketBase UTC datetimes.
 * @param {number|string|Object} data
 * @param {number} timeInSeconds
 * @param {string|null} actorId
 * @returns {Array}
 */
function findRecentTicketsByTicketNumber2(data, timeInSeconds = 10, actorId = null) {
    const ticketId = typeof data === "number" ? data : getTicketId(data);
    if (ticketId == null) return [];

    const now = new Date();
    const dateStart = new Date(now.getTime() - timeInSeconds * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "Z");

    let filter = "ticketId = {:ticketId} && created >= {:dateStart}";
    const filterParams = { ticketId, dateStart };
    if (actorId) {
        filter += " && zendeskActorId = {:actorId}";
        filterParams.actorId = String(actorId);
    }

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        filter,
        "created",
        20,
        0,
        filterParams
    );

    return records || [];
}

/**
 * @param {string} assignee_id
 * @returns {string|null}
 */
function getDiscordIdByAssigneeId(assignee_id) {
    if (!assignee_id) {
        $app.logger().info("No assignee_id provided");
        return null;
    }

    try {
        const records = $app.findRecordsByFilter(
            POCKET_ZENDESKUSER_DISCORDUSER,
            "zendesk_id = {:assigneeId}",
            "-created",
            1,
            0,
            { assigneeId: String(assignee_id) }
        );

        $app.logger().info("Found records:", "count", records?.length ?? 0);

        if (records && records.length > 0) {
            const discordId = records[0].get("discord_id");
            $app.logger().info("Discord ID found:", "discordId", discordId);
            return discordId ?? null;
        }
        return null;
    } catch (error) {
        $app.logger().error("Error getting Discord ID from PocketBase:", "error", error);
        return null;
    }
}

/**
 * @param {string|number} id
 * @returns {string|null}
 */
function getOrganizationById(id) {
    if (!id) {
        return null;
    }

    const record = new Record();
    try {
        $app.recordQuery(POCKET_COLLECTION_ZENDESK_ORGANIZATIONS)
            .andWhere($dbx.hashExp({ organizationId: id }))
            .limit(1)
            .one(record);

        if (!record || !record.get("id")) {
            return null;
        }

        return record.get("shortHand") ?? null;
    } catch (err) {
        $app.logger().error("Error getting organization:", "error", err);
        return null;
    }
}

/**
 * @param {Object} data
 * @returns {string|null}
 */
function getOrganizationName(data) {
    const body = privateGetBody(data);
    const id = body?.detail?.organization_id ?? body?.organization_id ?? null;
    return getOrganizationById(id);
}

function formatTicketMessage(prefix, fallbackPrefix, data) {
    const title = getTicketTitle(data);
    const id = getTicketId(data);
    const url = getZendeskUrl(data);
    if (url && id && title) {
        return ` ${prefix} | ${id}: [${title}](${url})`;
    }
    return `${fallbackPrefix}: ${url ?? "No URL available"}`;
}

function generateNormalTicketMessage(data) {
    const organizationName = getOrganizationName(data) ?? "Updated";
    return formatTicketMessage(organizationName, "Your ticket has been updated", data);
}

function generateSlaBreachingSoonMessage(data) {
    const org = getOrganizationName(data);
    const organizationName = org ? `Check SLA ${org}` : "Check SLA";
    return formatTicketMessage(organizationName, "SLA breaching soon", data);
}

function getDiscordIdfromData(data) {
    const assigneeId = getAssigneeId(data);
    if (!assigneeId) {
        $app.logger().error("Error getting assigneeId from Data in PocketBase:", "error");
        return null;
    }

    let discordId = null;
    try {
        discordId = getDiscordIdByAssigneeId(assigneeId);
    } catch (error) {
        $app.logger().error(
            `2: Error getting Discord ID for assignee: ${assigneeId} from PocketBase:`,
            "error",
            error
        );
    }

    return discordId || null;
}

function isTicketCreated(data) {
    const body = privateGetBody(data);
    return body?.type === ZENDESK_TICKET_CREATED;
}

module.exports = {
    getZendeskUrl,
    isJustinsTicket,
    isSlaBreaching,
    getTicketId,
    getTicketType,
    getAssigneeId,
    getActorId,
    privateGetBody,
    privateIsStatusChangedEvent,
    saveZendeskRecord,
    findRecentTicketsByTicketNumber2,
    getDiscordIdByAssigneeId,
    getOrganizationById,
    generateNormalTicketMessage,
    generateSlaBreachingSoonMessage,
    isTicketClosed,
    getDiscordIdfromData,
    isTicketCreated,
};

