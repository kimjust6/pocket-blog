# DaisyUI PocketPages Blog

A robust, multipage blog application built with **PocketPages** (PocketBase), styled with **DaisyUI** and **Tailwind CSS**.

## Features

*   **PocketPages Backend**: Leverages the power and simplicity of PocketBase for data management and authentication.
*   **Modern Styling**: Beautiful, responsive UI components provided by [DaisyUI](https://daisyui.com/) and [Tailwind CSS](https://tailwindcss.com/).
*   **Server-Side Rendering**: Uses EJS templates for dynamic content rendering.
*   **SEO Optimized**: Includes Open Graph metadata for rich social sharing (Twitter cards, Facebook, etc.).
*   **Search Functionality**: Built-in blog post search.
*   **Responsive Design**: Mobile-friendly layout that looks great on all devices.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (Latest LTS recommended)
*   [PocketBase](https://pocketbase.io/) (or use the included `npx phio` commands)

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

To start the development server with concurrent Tailwind CSS watching:

```bash
npm run dev
```

This command runs `pocketbase serve` and `tailwindcss` in watch mode.

### starting PocketBase Only

To just start the PocketBase server:

```bash
npm start
```

### CSS Watch

To run the Tailwind CSS watcher standalone:

```bash
npm run css
```

### Deployment

Deploy to Pockethost using `phio`:

```bash
npm run push
```

You may need to login first:

```bash
npm run login
```

## Project Structure

*   `pb_hooks/`: PocketBase hooks and server-side logic.
    *   `pages/`: Route handlers and EJS templates.
        *   `(navbarLayout)/`: Routes that include the main navigation bar.
        *   `_private/`: Reusable partials and components.
        *   `utils/`: Helper functions and constants.
*   `pb_data/`: PocketBase data directory (database files).
*   `tailwind.config.js`: Tailwind CSS configuration.
*   `package.json`: Project dependencies and scripts.



## Author

**Justin Kim**
