/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const blogPosts = app.findCollectionByNameOrId("pbc_1367580905");
  if (blogPosts) {
    const field = blogPosts.fields.getByName("coverImage");
    if (field) {
      field.thumbs = ["100x100", "350x0", "800x0", "1000x0"];
      app.save(blogPosts);
    }
  }

  const climbingPosts = app.findCollectionByNameOrId("pbc_1868599333");
  if (climbingPosts) {
    const field = climbingPosts.fields.getByName("coverImage");
    if (field) {
      field.thumbs = ["100x100", "350x0", "800x0", "1000x0"];
      app.save(climbingPosts);
    }
  }
}, (app) => {
  const blogPosts = app.findCollectionByNameOrId("pbc_1367580905");
  if (blogPosts) {
    const field = blogPosts.fields.getByName("coverImage");
    if (field) {
      field.thumbs = null;
      app.save(blogPosts);
    }
  }

  const climbingPosts = app.findCollectionByNameOrId("pbc_1868599333");
  if (climbingPosts) {
    const field = climbingPosts.fields.getByName("coverImage");
    if (field) {
      field.thumbs = ["100x100", "350x0"];
      app.save(climbingPosts);
    }
  }
})
