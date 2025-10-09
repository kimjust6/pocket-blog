const { POCKET_COLLECTION_ZENDESK_TICKETS }
    = require(`${__hooks}/pages/utils/constants.js`);

const {
    getTicketId,
    getTicketType
} = require(`${__hooks}/pages/utils/common.js`);

function saveZendeskRecord(data) {
    if (!data) {
        throw new Error("Invalid collection or data");
    }

    let collection = $app.findCollectionByNameOrId(POCKET_COLLECTION_ZENDESK_TICKETS)

    if (!collection) {
        return e.json(404, { error: "zendesk_tickets collection not found" });
    }

    let record = new Record(collection)

    record.set("data", JSON.stringify(data))
    record.set("ticketId", getTicketId(data))
    record.set("ticketType", getTicketType(data))
    record.set("created", Date.now())
    record.set("updated", Date.now())

    $app.save(record);

}

function findRecentTicketByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return null;
    }

    let record = new Record();
    $app.recordQuery(POCKET_COLLECTION_ZENDESK_TICKETS)
        .andWhere($dbx.hashExp({ "ticketId": ticketId }))
        .orderBy("created DESC")
        .limit(1)
        .one(record)

    // check if the record was created within the last `timeInSeconds` seconds
    if (record) {
        const createdTime = new Date(record.get("created")).getTime();
        const currentTime = Date.now();
        const timeDiff = (currentTime - createdTime)
        if (timeDiff <= timeInSeconds * 1000) {
            return record;
        }
        return null;
    }
    return null;
}

module.exports = {
    saveZendeskRecord,
    findRecentTicketByTicketNumber
}