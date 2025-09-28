/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/clippy/zendesk", async (e) => {
    try {
        let data = e.requestInfo()
        let collection = $app.findCollectionByNameOrId("zendesk_tickets")
        let record = new Record(collection)

        record.set("data", JSON.stringify(data))
        record.set("created", Date.now())
        record.set("updated", Date.now())

        $app.save(record);


        return e.json(201, record);
        // return e.json(201, { message: "Ticket received", data: data });
    } catch (err) {
        return e.json(500, {
            error: err?.message || "Failed to create Zendesk ticket",
        });
    }
});


routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(200, { "message": "Hello" })
})







