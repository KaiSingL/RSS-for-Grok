// server.js
const http = require('http');
const path = require('path');
const PatreonRSS = require('./patreon-rss.js');
const YouTubeRSS = require('./youtube-rss.js');
const BilibiliRSS = require('./bilibili-rss.js');

const PORT = process.env.PORT || 80; // Use 80 for no-port URLs; fallback to env for cloud
const CACHE_DIR = __dirname; // Directory for cache files
const CACHE_MAX_AGE = 60 * 60; // 1 hour in seconds

const server = http.createServer(async (req, res) => {
	let urlPath = req.url.trim().replace(/^\//, '').replace(/\/$/, ''); // Get path without leading/trailing slashes

	if (!urlPath) {
		// Serve home page HTML
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSS Generator for Patreon, YouTube, and Bilibili</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        select, input { padding: 10px; width: 200px; }
        button { padding: 10px 20px; margin-left: 10px; }
    </style>
</head>
<body>
    <h1>RSS Generator for Patreon, YouTube, and Bilibili</h1>
    <p>Select platform and enter creator/channel/user ID to generate the RSS feed:</p>
    <select id="platform">
        <option value="p">Patreon</option>
        <option value="yt">YouTube</option>
        <option value="bi">Bilibili</option>
    </select>
    <input type="text" id="creatorId" placeholder="e.g., 42276522 or UCmi1257Mo7v4ors9-ekOq1w or 1234567">
    <button onclick="search()">Generate</button>
    <script>
        function search() {
            const platform = document.getElementById('platform').value;
            const id = document.getElementById('creatorId').value.trim();
            if (!id) {
                alert('Please enter a valid ID.');
                return;
            }
            if (platform === 'p' && isNaN(id)) {
                alert('Patreon ID must be numeric.');
                return;
            } else if (platform === 'yt' && !id.startsWith('UC')) {
                alert('YouTube Channel ID must start with "UC".');
                return;
            } else if (platform === 'bi' && isNaN(id)) {
                alert('Bilibili user ID must be numeric.');
                return;
            }
            window.location.href = '/' + platform + '/' + id;
        }
        document.getElementById('creatorId').addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                search();
            }
        });
    </script>
</body>
</html>
        `;
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(html);
		return;
	}

	const parts = urlPath.split('/');
	if (parts.length !== 2) {
		sendError(
			res,
			'Invalid path. Use /p/{id} for Patreon, /yt/{id} for YouTube, or /bi/{id} for Bilibili.'
		);
		return;
	}

	const platform = parts[0].toLowerCase();
	const id = parts[1];

	let rssGenerator;
	if (platform === 'p') {
		if (isNaN(id)) {
			sendError(res, 'Invalid Patreon ID: must be numeric.');
			return;
		}
		rssGenerator = new PatreonRSS(id);
	} else if (platform === 'yt') {
		if (!id.startsWith('UC')) {
			sendError(res, 'Invalid YouTube ID: must start with "UC".');
			return;
		}
		rssGenerator = new YouTubeRSS(id);
	} else if (platform === 'bi') {
		if (isNaN(id)) {
			sendError(res, 'Invalid Bilibili ID: must be numeric.');
			return;
		}
		rssGenerator = new BilibiliRSS(id);
	} else {
		sendError(
			res,
			'Invalid platform. Use "p" for Patreon, "yt" for YouTube, or "bi" for Bilibili.'
		);
		return;
	}

	try {
		const rssContent = await rssGenerator.cachedRSS(CACHE_DIR, CACHE_MAX_AGE);

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

function sendError(res, message) {
	const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error - RSS Generator</title>
</head>
<body>
    <h1>Error</h1>
    <p>${message}</p>
    <a href="/">Back to Home</a>
</body>
</html>
    `;
	res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
	res.end(errorHtml);
}

server.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}/`);
});
