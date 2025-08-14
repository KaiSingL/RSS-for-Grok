# Patreon and YouTube RSS Server

This is a simple HTTP server that generates RSS feeds for Patreon creators and YouTube channels. It fetches recent posts or videos, converts them to a unified RSS 2.0 format, and caches the results to reduce API calls.

For Patreon, public (text) posts are available as full text, while restricted posts only show the title. It uses an unofficial API (the same that powers the Patreon website), so there are no guarantees it won't break.

For YouTube, it fetches from the official Atom feed and converts it to RSS, including video teasers, thumbnails, and links.

The server includes a basic HTML homepage for selecting the platform (Patreon or YouTube) and entering the creator/channel ID. It handles errors for invalid paths or IDs and unifies the RSS output with teasers, images, and continue links.

## Features

- Supports both Patreon creators and YouTube channels.
- Caches feeds to minimize API/feed requests.
- Unified RSS 2.0 format for easy consumption.
- Basic error handling and logging.
- Preserves HTML in descriptions using CDATA.

## Installation

1. Ensure Node.js v18+ is installed (for native fetch support).
2. Clone the repository.
3. Run `npm install` to install dependencies (e.g., xml2js).
4. Start the server: `node server.js`.
   - The server listens on port 80 by default (or set via `PORT` environment variable).

## Usage

- Access the homepage at `http://localhost/` (or your server's URL) to select the platform and enter the ID.
- Direct RSS feeds:
  - Patreon: `http://localhost/p/<patreon_creator_id>` (e.g., `/p/42276522`).
  - YouTube: `http://localhost/yt/<youtube_channel_id>` (e.g., `/yt/UCmi1257Mo7v4ors9-ekOq1w`).
- IDs: Numeric for Patreon; starts with 'UC' for YouTube channels.

## Notes

- This project assumes public Patreon posts and YouTube channels; no authentication required.
- Caching is file-based in the project root; ensure the directory is writable.
- For Patreon, this is still a hack using an unofficial API—use at your own risk.
- There's a Composer-based alternative for Patreon at https://github.com/daemionfox/patreon-feed, which you might prefer for Patreon-only needs.

## Development

- Main files: `server.js` (HTTP server), `patreon-rss.js` (Patreon logic), `youtube-rss.js` (YouTube logic).
- Debugging: Check console logs for errors.
- Testing: Use a browser or curl to request feeds and verify RSS output.
