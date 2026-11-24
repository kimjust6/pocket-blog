/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1868599333")

  // update collection data
  unmarshal({
    "name": "climbing_posts"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1868599333")

  // update collection data
  unmarshal({
    "name": "climbing_logs"
  }, collection)

  return app.save(collection)
})
