/**
 * Barrel module re-exporting domain helpers for backward compatibility and AGENTS.md compliance.
 * Implementations live in `./discord.js`, `./zendesk.js`, `./blog.js`, `./seo.js`, `./analytics.js`, `./format.js`, `./pocket.js`, and `./http.js`.
 */
const discord = require("./discord.js");
const zendesk = require("./zendesk.js");
const blog = require("./blog.js");
const http = require("./http.js");

module.exports = Object.assign(
    {},
    discord,
    zendesk,
    blog,
    http
);
