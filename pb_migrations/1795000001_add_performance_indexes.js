migrate((app) => {
    try {
        const blogPosts = app.findCollectionByNameOrId("blog_posts");
        if (blogPosts) {
            blogPosts.indexes = [
                "CREATE INDEX `idx_blog_posts_deleted_date` ON `blog_posts` (`isDeleted`, `manualPublishDate`, `created`)",
                "CREATE INDEX `idx_blog_posts_tags` ON `blog_posts` (`tags`)"
            ];
            app.save(blogPosts);
        }

        const climbingPosts = app.findCollectionByNameOrId("climbing_posts");
        if (climbingPosts) {
            climbingPosts.indexes = [
                "CREATE INDEX `idx_climbing_posts_deleted_date` ON `climbing_posts` (`isDeleted`, `date`, `created`)",
                "CREATE INDEX `idx_climbing_posts_type` ON `climbing_posts` (`climbType`)"
            ];
            app.save(climbingPosts);
        }

        const zendeskTickets = app.findCollectionByNameOrId("zendesk_tickets");
        if (zendeskTickets) {
            zendeskTickets.indexes = [
                "CREATE INDEX `idx_zendesk_tickets_lookup` ON `zendesk_tickets` (`ticketId`, `created`)"
            ];
            app.save(zendeskTickets);
        }

        const zendeskDiscord = app.findCollectionByNameOrId("zendeskuser_discorduser");
        if (zendeskDiscord) {
            zendeskDiscord.indexes = [
                "CREATE INDEX `idx_zendesk_discord_lookup` ON `zendeskuser_discorduser` (`zendesk_id`)"
            ];
            app.save(zendeskDiscord);
        }
        console.log('[MIGRATION] Successfully created performance indexes');
    } catch (e) {
        console.log('[MIGRATION] Error creating performance indexes:', e);
    }
}, (app) => {
    try {
        const collections = ["blog_posts", "climbing_posts", "zendesk_tickets", "zendeskuser_discorduser"];
        collections.forEach((name) => {
            const col = app.findCollectionByNameOrId(name);
            if (col) {
                col.indexes = [];
                app.save(col);
            }
        });
    } catch (_) {}
});
