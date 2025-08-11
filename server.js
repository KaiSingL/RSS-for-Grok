const http = require('http');
const path = require('path');
const PatreonRSS = require('./patreon-rss.js'); // Import the class

const PORT = 8000; // Change if needed
const CACHE_DIR = __dirname; // Directory for cache files
const CACHE_MAX_AGE = 60 * 60; // 1 hour in seconds

const server = http.createServer(async (req, res) => {
	const urlPath = req.url.trim().replace(/^\//, '').replace(/\/$/, ''); // Get path without leading/trailing slashes

	if (!urlPath || isNaN(urlPath)) {
		res.writeHead(200, {
			'Content-Type': 'application/rss+xml; charset=utf-8',
		});
		res.end('Invalid or missing creator ID. Use /<creator_id>, e.g., /6637687');
		return;
	}

	const creatorId = urlPath; // The path is the creator ID

	try {
		const patreon = new PatreonRSS(creatorId);
		const rssContent = await patreon.cachedRSS(CACHE_DIR, CACHE_MAX_AGE);

		res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end(rssContent);
	} catch (error) {
		console.error('Error generating RSS:', error);
		res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('Error generating RSS feed');
	}
});

server.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}/`);
});
