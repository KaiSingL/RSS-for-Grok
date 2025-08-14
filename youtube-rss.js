// youtube-rss.js
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

/**
 * Class YouTubeRSS
 *
 * Simple class to fetch Atom feed from YouTube and convert to RSS feed
 */
class YouTubeRSS {
	/**
	 * YouTubeRSS constructor.
	 * @param {string} id
	 */
	constructor(id) {
		this.id = id;
	}

	/**
	 * Generate the RSS as a string
	 * @return {Promise<string>}
	 */
	async rss() {
		const data = await this.getData();
		const BOM = '\uFEFF'; // UTF-8 BOM
		let rss = BOM + '<?xml version="1.0" encoding="UTF-8"?>\n';
		rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
		rss += '<channel>\n';
		rss += this.getRssChannelInfo(data.campaign, data.user);
		for (const item of data.posts) {
			rss += this.getRssItem(item, data.user);
		}
		rss += '</channel>\n';
		rss += '</rss>';
		return rss;
	}

	/**
	 * Get the RSS (with caching) as a string
	 *
	 * Note: this does absolutely no error checking and will just ignore errors. You have
	 * to make sure the given dir exists and is writable. Otherwise there will be no caching
	 *
	 * @param {string} dir directory in which to store cache files - has to be writable
	 * @param {number} maxage maximum age for the cache in seconds
	 * @return {Promise<string>}
	 */
	async cachedRSS(dir, maxage) {
		const cachefile = path.join(dir, `${this.id}.xml`);
		let lastmod = 0;
		try {
			const stats = fs.statSync(cachefile);
			lastmod = stats.mtimeMs;
		} catch (e) {
			// Ignore
		}

		if (Date.now() - lastmod < maxage * 1000) {
			try {
				return fs.readFileSync(cachefile, 'utf8');
			} catch (e) {
				// Ignore and regenerate
			}
		}

		const rssContent = await this.rss();

		try {
			fs.writeFileSync(cachefile, rssContent);
		} catch (e) {
			// Ignore errors
		}

		return rssContent;
	}

	/**
	 * Constructs the URL for the YouTube feed
	 *
	 * @return {string}
	 */
	getURL() {
		return `https://www.youtube.com/feeds/videos.xml?channel_id=${this.id}`;
	}

	/**
	 * Fetches the data from YouTube and cleans it up for our usecase
	 *
	 * @return {Promise<Object>}
	 */
	async getData() {
		const apiUrl = this.getURL();
		const response = await fetch(apiUrl);
		const xmlText = await response.text();
		const parser = new xml2js.Parser({ explicitArray: false });
		const json = await parser.parseStringPromise(xmlText);
		const feed = json.feed;

		// Handle links (may be array or single object)
		const links = Array.isArray(feed.link) ? feed.link : [feed.link];
		const channel_link =
			links.find((l) => l.$.rel === 'alternate')?.$.href || '';

		const clean = {
			posts: [],
			user: {},
			campaign: {},
		};

		clean.user = {
			full_name: feed.author?.name || feed.title || 'Unknown Channel',
			url: channel_link,
			image_url: '',
		};

		clean.campaign = {
			summary: `Videos from YouTube channel ${feed.title || 'Unknown'}`,
		};

		const entries = Array.isArray(feed.entry)
			? feed.entry
			: feed.entry
			? [feed.entry]
			: [];
		clean.posts = entries.map((entry) => {
			const entry_link = entry.link?.$.href || '';
			const media = entry['media:group'] || {};
			const description = media['media:description'] || '';
			const thumbnail = media['media:thumbnail']?.$.url || '';

			return {
				title: entry.title || '',
				content: description.replace(/\n/g, '<br />'),
				published_at: entry.published,
				url: entry_link,
				image: {
					thumb_image_url: thumbnail,
				},
			};
		});

		return clean;
	}

	/**
	 * Get a single post as RSS item string
	 *
	 * @param {Object} item
	 * @param {Object} user
	 * @return {string}
	 */
	getRssItem(item, user) {
		let xml = '<item>\n';
		xml += '<title>' + this.escapeXml(item.title || '') + '</title>\n';
		xml +=
			'<author>' +
			this.escapeXml(user.full_name || 'Anonymous') +
			'</author>\n';
		xml += '<link>' + this.escapeXml(item.url || '') + '</link>\n';
		xml += '<guid>' + this.escapeXml(item.url || '') + '</guid>\n';
		xml +=
			'<pubDate>' + new Date(item.published_at).toUTCString() + '</pubDate>\n';

		// Description with teaser, image, and continue link; preserve HTML with CDATA
		let descContent =
			item.teaser_text || (item.content || '').slice(0, 300) + '...'; // Use teaser or truncated content; no stripTags to preserve HTML
		const image = item.image || {};
		const imageTag = image.thumb_image_url
			? `<img src="${this.escapeXml(
					image.thumb_image_url
			  )}" alt="${this.escapeXml(item.title || 'Video thumbnail')}" />`
			: '';
		descContent = `${imageTag}${descContent}<br><a href="${this.escapeXml(
			item.url
		)}">Continue Watching on YouTube</a>`;
		// Handle CDATA edge cases
		descContent = descContent.replace(/]]>/g, ']]]]><![CDATA[>');
		xml += '<description><![CDATA[' + descContent + ']]></description>\n';

		xml += '</item>\n';
		return xml;
	}

	/**
	 * Get the channel info as string from our campaign and user data
	 *
	 * @param {Object} campaign
	 * @param {Object} user
	 * @return {string}
	 */
	getRssChannelInfo(campaign, user) {
		let xml =
			'<title>' +
			this.escapeXml(user.full_name || 'Unknown Channel') +
			' on YouTube</title>\n';
		xml +=
			'<description>' +
			this.escapeXml(this.stripTags(campaign.summary || '')) +
			'</description>\n';
		xml += '<link>' + this.escapeXml(user.url || '') + '</link>\n';
		xml += '<language>en-US</language>\n';
		xml += '<generator>YouTube RSS Generator v1.0</generator>\n';
		xml +=
			'<atom:link href="' +
			this.escapeXml(user.url || '') +
			'" rel="self" type="application/rss+xml" />\n';
		return xml;
	}

	/**
	 * Escape XML special characters
	 * @param {string} str
	 * @return {string}
	 */
	escapeXml(str) {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Strip HTML tags (simple implementation)
	 * @param {string} html
	 * @return {string}
	 */
	stripTags(html) {
		if (html == null) return '';
		return html.replace(/<[^>]*>/g, '');
	}
}

module.exports = YouTubeRSS;
