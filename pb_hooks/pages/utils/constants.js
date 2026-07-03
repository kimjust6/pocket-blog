const POCKET_BLOGPOSTS = "blog_posts"
const POCKET_CLIMBING_POSTS = "climbing_posts"
const POCKET_ZENDESKUSER_DISCORDUSER = "zendeskuser_discorduser"
const POCKET_SLA_BREACHING_SOON = "nearing_sla_breach_notified"
const DISCORD_API_ENDPOINT = "https://zen.jkim.win/api/discord/send-dm/";
const ZENDESK_API_ENDPOINT = "https://yaksa.zendesk.com/agent/tickets/";
const POCKET_COLLECTION_ZENDESK_TICKETS = "zendesk_tickets";

const POCKET_COLLECTION_ADMIN_SETTINGS = "admin_settings";
const POCKET_COLLECTION_ZENDESK_ORGANIZATIONS = "zendesk_organizations";

const ZENDESK_CLOSED_STATUS = "CLOSED";
const ZENDESK_SOLVED_STATUS = "SOLVED";
const ZENDESK_STATUS_CHANGED_TYPE = "zen:event-type:ticket.status_changed";
const ZENDESK_TICKET_CREATED = "zen:event-type:ticket.created";

const ZENDESK_ASSIGNEE_ID_JUSTIN = "35387898477463";
const DISCORD_ID_JUSTIN = "90909125164163072";

const POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS = "IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS";
const POCKET_ADMIN_MAX_RANDOM_DELAY_IN_SECONDS = "MAX_RANDOM_DELAY_IN_SECONDS";
const POCKET_ADMIN_DISCORD_BOT_TOKEN = "SECRET_DISCORD_BOT_TOKEN";


const COLLECTION_CONFIG_URL = "https://www.toronto.ca/app_content/swm_collection_calendar_config/";
const COLLECTION_CALENDAR_URL = "https://www.toronto.ca/ext/swms/collection_calendar.csv";
const COLLECTION_ENDPOINT_HEADERS = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.7",
    Origin: "https://www.toronto.ca",
    Referer: "https://www.toronto.ca/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
};

const DISCORD_MESSAGE_MAX_LENGTH = 1900;
const COLLECTION_TYPE_METADATA = {
    GreenBin: {
        title: "Green Bin",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-green-bin/",
    },
    Garbage: {
        title: "Garbage",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-garbage-bin/",
    },
    Recycling: {
        title: "Recycling",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/what-goes-in-my-blue-bin/",
    },
    YardWaste: {
        title: "Yard Waste",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/yard-waste/",
    },
    ChristmasTree: {
        title: "Christmas Tree",
        url: "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/yard-waste/",
    },
};

const COLLECTION_DAY_NAMES = {
    M: "Monday",
    T: "Tuesday",
    W: "Wednesday",
    R: "Thursday",
    F: "Friday",
    S: "Saturday",
    0: "No pick-up",
};

const WEEKDAY_INDEX = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
};

const COLLECTION_ENDPOINT_BASE_URL = "https://map.toronto.ca/cotgeocoder/rest/geocoder/findAddressCandidates";
const COLLECTION_SUGGEST_URL = "https://map.toronto.ca/cotgeocoder/rest/geocoder/suggest";
const DEFAULT_COLLECTION_KEY_STRING = "ADDRESS:geoid:546720:rowid:367935";

module.exports = {
    POCKET_BLOGPOSTS,
    POCKET_CLIMBING_POSTS,
    POCKET_ZENDESKUSER_DISCORDUSER,
    POCKET_SLA_BREACHING_SOON,
    DISCORD_API_ENDPOINT,
    ZENDESK_API_ENDPOINT,
    POCKET_COLLECTION_ZENDESK_TICKETS,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_COLLECTION_ZENDESK_ORGANIZATIONS,
    ZENDESK_CLOSED_STATUS,
    ZENDESK_SOLVED_STATUS,
    ZENDESK_STATUS_CHANGED_TYPE,
    ZENDESK_TICKET_CREATED,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    DISCORD_ID_JUSTIN,
    POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS,
    POCKET_ADMIN_MAX_RANDOM_DELAY_IN_SECONDS,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
    COLLECTION_CONFIG_URL,
    COLLECTION_CALENDAR_URL,
    COLLECTION_ENDPOINT_HEADERS,
    DISCORD_MESSAGE_MAX_LENGTH,
    COLLECTION_TYPE_METADATA,
    COLLECTION_DAY_NAMES,
    WEEKDAY_INDEX,
    COLLECTION_ENDPOINT_BASE_URL,
    COLLECTION_SUGGEST_URL,
    DEFAULT_COLLECTION_KEY_STRING,
}
