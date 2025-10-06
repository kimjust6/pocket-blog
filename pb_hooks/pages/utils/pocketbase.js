const { POCKET_COLLECTION_ZENDESK_TICKETS }
    = require(`${__hooks}/pages/utils/constants.js`);

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
    record.set("created", Date.now())
    record.set("updated", Date.now())

    $app.save(record);

}


module.exports = {
    saveZendeskRecord
}