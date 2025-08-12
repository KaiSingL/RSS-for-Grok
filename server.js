const http = require('http');
const path = require('path');
const PatreonRSS = require('./patreon-rss.js'); // Import the class

const PORT = process.env.PORT || 80; // Use 80 for no-port URLs; fallback to env for cloud
const CACHE_DIR = __dirname; // Directory for cache files
const CACHE_MAX_AGE = 60 * 60; // 1 hour in seconds

const server = http.createServer(async (req, res) => {
	const urlPath = req.url.trim().replace(/^\//, '').replace(/\/$/, ''); // Get path without leading/trailing slashes

	if (!urlPath) {
		// Serve home page HTML
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Patreon RSS Generator</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        input { padding: 10px; width: 200px; }
        button { padding: 10px 20px; margin-left: 10px; }
    </style>
</head>
<body>
    <h1>Patreon RSS Generator</h1>
    <p>Enter a Patreon creator ID to generate the RSS feed:</p>
    <input type="text" id="creatorId" placeholder="e.g., 6637687">
    <button onclick="search()">Search</button>
    <script>
        function search() {
            const id = document.getElementById('creatorId').value.trim();
            if (id && !isNaN(id)) {
                window.location.href = '/' + id;
            } else {
                alert('Please enter a valid numeric creator ID.');
            }
        }
    </script>
</body>
</html>
        `;
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(html);
		return;
	}

	const creatorId = urlPath; // The path is the creator ID

	if (isNaN(creatorId)) {
		// Serve simple HTML error for invalid ID
		const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error - Patreon RSS Generator</title>
</head>
<body>
    <h1>Error</h1>
    <p>Invalid or missing creator ID. Please use a numeric ID, e.g., /6637687.</p>
    <a href="/">Back to Home</a>
</body>
</html>
        `;
		res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(errorHtml);
		return;
	}

	try {
		const patreon = new PatreonRSS(creatorId);
		const rssContent = await patreon.cachedRSS(CACHE_DIR, CACHE_MAX_AGE);

		res.writeHead(200, {
			'Content-Type': 'application/rss+xml; charset=utf-8',
		});
		res.end(rssContent);
	} catch (error) {
		console.error('Error generating RSS:', error);
		res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('Error generating RSS feed');
	}
});

server.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}/`);
});
