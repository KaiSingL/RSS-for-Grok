# Patreon, YouTube, and Bilibili RSS Server

This is a simple HTTP server that generates RSS feeds for Patreon creators, YouTube channels, and Bilibili users. It fetches recent posts, videos, or uploads, converts them to a unified RSS 2.0 format, and caches the results to reduce API calls or scraping overhead.
For Patreon, public (text) posts are available as full text, while restricted posts only show the title. It uses an unofficial API (the same that powers the Patreon website), so there are no guarantees it won't break.
For YouTube, it fetches from the official Atom feed and converts it to RSS, including video teasers, thumbnails, and links.
For Bilibili, it uses browser scraping (via Puppeteer) to fetch user videos, including titles, publish dates, and links. This is unofficial and may break if the site changes.
The server includes a basic HTML homepage for selecting the platform (Patreon, YouTube, or Bilibili) and entering the creator/channel/user ID. It handles errors for invalid paths or IDs and unifies the RSS output with teasers, images, and continue links where applicable.

## Features

- Supports Patreon creators, YouTube channels, and Bilibili users.
- Caches feeds to minimize API/feed requests or scraping.
- Unified RSS 2.0 format for easy consumption.
- Basic error handling and logging.
- Preserves HTML in descriptions using CDATA (where applicable).

## Installation

1. Ensure Node.js v18+ is installed (for native fetch support).
2. Clone the repository.
3. Run `npm install xml2js puppeteer` to install dependencies.
4. Start the server: `node server.js`.
   - The server listens on port 80 by default (or set via `PORT` environment variable).

## Usage

- Access the homepage at `http://localhost/` (or your server's URL) to select the platform and enter the ID.
- Direct RSS feeds:
  - Patreon: `http://localhost/p/<patreon_creator_id>` (e.g., `/p/42276522`).
  - YouTube: `http://localhost/yt/<youtube_channel_id>` (e.g., `/yt/UCmi1257Mo7v4ors9-ekOq1w`).
  - Bilibili: `http://localhost/bi/<bilibili_user_id>` (e.g., `/bi/1234567`).
- IDs: Numeric for Patreon and Bilibili; starts with 'UC' for YouTube channels.

## Notes

- This project assumes public Patreon posts, YouTube channels, and Bilibili user videos; no authentication required.
- Caching is file-based in the project root (with platform prefixes like p*, yt*, bi\_ for filenames); ensure the directory is writable.
- For Patreon and Bilibili, this uses unofficial methods (API/scraping)—use at your own risk, as they may break.
- For Bilibili, scraping may be slow and resource-intensive; ensure Puppeteer can launch a browser (may require additional OS dependencies like libnss3 on Linux).
- There's a Composer-based alternative for Patreon at https://github.com/daemionfox/patreon-feed, which you might prefer for Patreon-only needs.

## Development

- Main files: `server.js` (HTTP server), `patreon-rss.js` (Patreon logic), `youtube-rss.js` (YouTube logic), `bilibili-rss.js` (Bilibili logic).
- Debugging: Check console logs for errors.
- Testing: Use a browser or curl to request feeds and verify RSS output.
