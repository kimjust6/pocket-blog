# Justin's Blog

A personal blog application built with **PocketPages** (PocketBase), styled with **DaisyUI** and **Tailwind CSS**.

## Features

*   **PocketPages Backend**: fast and simple backend with PocketBase.
*   **Modern UI**: Clean, responsive design using [DaisyUI](https://daisyui.com/) and [Tailwind CSS](https://tailwindcss.com/).
*   **Server-Side Rendering**: Fast pages using EJS templates.
*   **Zen Mode**: A dedicated minimalist page.
*   **Custom Integrations**: Includes Zendesk and Discord webhook integrations.

## Prerequisites

*   [Node.js](https://nodejs.org/) (Latest LTS)
*   [PocketBase](https://pocketbase.io/)

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/kimjust6/pocket-blog.git
    cd pocket-blog
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

### Development

Run PocketBase and Tailwind watcher concurrently:

```bash
npm run dev
```

### Deployment

Deploy to Pockethost:

```bash
npm run push
```

## Project Structure

*   `pb_hooks/`: Server-side logic and pages.
    *   `pages/`: Route handlers (EJS).
        *   `(navbarLayout)/`: Main pages with navigation.
        *   `_private/`: Partials and internal logic.
*   `pb_data/`: Database files.

## Author

**Justin Kim**
