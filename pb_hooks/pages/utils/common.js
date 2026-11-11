/**
 * Barrel module re-exporting domain helpers for backward compatibility and AGENTS.md compliance.
 * Implementations live in `./discord.js`, `./zendesk.js`, `./blog.js`, and `./http.js`.
 */
const discord = require("./discord.js");
const zendesk = require("./zendesk.js");
const blog = require("./blog.js");
const { decodeHttpBody } = require("./http.js");

module.exports = Object.assign(
    {},
    discord,
    zendesk,
    blog,
    { decodeHttpBody }
);
