# AGENTS.md - Project Best Practices & Guidelines

Guidelines and coding standards for AI agents working in this PocketPages & PocketBase blog codebase (`pocket-blog`).

## Architecture & Code Structure

### 1. Server-Side Logic in `pb_hooks`
- **Keep Views Clean**: Delegate data processing, pagination, metadata generation, and view model assembly to helper functions in `pb_hooks/pages/utils/common.js` or `pb_hooks/pages/utils/pocket.js`.
- **Database Queries**: Use PocketBase `$app` methods (such as `$app.findRecordsByFilter` and `$app.db()`) within `pocket.js`. Always enforce `isDeleted = false` filters.
- **Server Context**: Use `<script server>` in EJS pages to invoke backend helpers and set up structured view parameters before rendering HTML.

### 2. Analytics & Privacy
- **Server-Side Tracking**: Track analytics events (e.g. search queries, item views) on the backend using `trackGAEvent` via GA4 Measurement Protocol (`$http.send`).
- **Privacy Compliance**:
  - Always enforce `anonymize_ip: true` and `allow_google_signals: false` to avoid privacy and Google Search Console tracking violations.
  - Sanitize all user search inputs using `sanitizeSearchTerm` before logging or sending analytics events (remove HTML tags, emails, credentials, and URL tokens).

### 3. Frontend & Styling
- **Tailwind & DaisyUI**: Use DaisyUI component classes (e.g. `btn`, `card`, `badge`, `join`) and Tailwind utility classes.
- **Theme Compatibility**: Ensure layouts support both `nord` and `dark` themes.
- **Interactive Badges**: Tag and category badges should use interactive styling (`hover:bg-base-content hover:text-base-100 transition-all duration-200 cursor-pointer`) and link directly to search URLs (`?query=<tag>`).

### 4. Code Quality & Verification
- **Syntax Check**: Run `node -c` on modified backend JavaScript files (`common.js`, `pocket.js`, `main.pb.js`) to verify syntax before declaring completion.
