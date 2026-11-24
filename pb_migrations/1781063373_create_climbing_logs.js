/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "climbing_logs",
    type: "base",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "date",
        type: "date",
        required: true,
      },
      {
        name: "location",
        type: "text",
      },
      {
        name: "climbType",
        type: "select",
        maxSelect: 1,
        values: ["Bouldering", "Sport", "Top Rope", "Trad"]
      },
      {
        name: "grade",
        type: "text",
      },
      {
        name: "style",
        type: "select",
        maxSelect: 1,
        values: ["Send", "Flash", "Onsight", "Project", "Hangdog"]
      },
      {
        name: "content",
        type: "editor",
      },
      {
        name: "coverImage",
        type: "file",
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        thumbs: ["100x100", "350x0"],
        protected: false
      },
      {
        name: "isDeleted",
        type: "bool",
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      }
    ],
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("climbing_logs");
  if (collection) {
    return app.delete(collection);
  }
})


