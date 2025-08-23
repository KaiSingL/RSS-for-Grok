// patreon-rss.js
// Updated patreon-rss.js
const fs = require('fs');
const path = require('path');
const url = require('url');

// No hardcoded CREATOR_ID anymore; it's passed to constructor

/**
 * Class PatreonRSS
 *
 * Very simple class to fetch posts from Patreon and create an RSS feed from it
 *
 * A bit hacky and could be improved a lot, but works
 */
class PatreonRSS {
	/** @type {Object} which fields to include in the response, for now we don't need much */
	fields = {
		post: [
			'post_type',
			'title',
			'content',
			'published_at',
			'url',
			'teaser_text',
			'image',
		], // Added teaser_text and image
		user: ['image_url', 'full_name', 'url'],
	};

	/** @type {Object} haven't really played with those, except the creator id */
	filter = {
		is_by_creator: true,
		is_following: false,
		creator_id: 'set by constructor',
		contains_exclusive_posts: true,
	};

	/**
	 * PatreonRSS constructor.
	 * @param {string} id
	 */
	constructor(id) {
		this.filter.creator_id = id;
	}

	/**
	 * Generate the RSS as a string
	 * @return {Promise<string>}
	 */
	async rss() {
		const data = await this.getData();
		const BOM = '\uFEFF'; // UTF-8 BOM
		let rss = BOM + '<?xml version="1.0" encoding="UTF-8"?>\n';
		rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'; // Added atom namespace
		rss += '<channel>\n';
		rss += this.getRssChannelInfo(data.campaign, data.user);
		for (const item of data.posts) {
			rss += this.getRssItem(item, data.user); // Passed user for author
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
		const cachefile = path.join(dir, `p_${this.filter.creator_id}.xml`);
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
	 * Constructs the URL based on the fields and filter config at the top
	 *
	 * @return {string}
	 */
	getURL() {
		let apiUrl = new URL('https://api.patreon.com/stream');
		apiUrl.searchParams.append('json-api-version', '1.0');

		for (const [type, set] of Object.entries(this.fields)) {
			apiUrl.searchParams.append(`fields[${type}]`, set.join(','));
		}

		for (const [key, val] of Object.entries(this.filter)) {
			let value = val;
			if (value === true) value = 'true';
			if (value === false) value = 'false';
			apiUrl.searchParams.append(`filter[${key}]`, value);
		}

		apiUrl.searchParams.append('page[cursor]', 'null');

		return apiUrl.toString();
	}

	/**
	 * Fetches the data from Patreon and cleans it up for our usecase
	 *
	 * @return {Promise<Object>}
	 */
	async getData() {
		const apiUrl = this.getURL();
		const response = await fetch(apiUrl);
		const json = await response.json();

		const clean = {
			posts: [],
			user: {},
			campaign: {},
		};

		for (const item of json.data) {
			clean.posts.push(item.attributes);
		}

		for (const item of json.included) {
			if (item.type === 'user') {
				clean.user = { ...item.attributes, id: item.id };
				continue;
			}
			if (item.type === 'campaign') {
				clean.campaign = { ...item.attributes, id: item.id };
			}
		}

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
			'</author>\n'; // Added author
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
			  )}" alt="${this.escapeXml(item.title || 'Post image')}" />`
			: '';
		descContent = `${imageTag}${descContent}<br><a href="${this.escapeXml(
			item.url
		)}">Continue Reading on Patreon</a>`;
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
			this.escapeXml(user.full_name || 'Unknown Creator') +
			' on Patreon</title>\n'; // Updated title to use user name
		xml +=
			'<description>' +
			this.escapeXml(this.stripTags(campaign.summary || '')) +
			'</description>\n';
		xml += '<link>' + this.escapeXml(user.url || '') + '</link>\n';
		xml += '<language>en-US</language>\n'; // Added language
		xml += '<generator>Patreon RSS Generator v1.0</generator>\n'; // Added generator
		xml +=
			'<atom:link href="' +
			this.escapeXml(user.url || '') +
			'" rel="self" type="application/rss+xml" />\n'; // Added atom:link using user url
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

module.exports = PatreonRSS; // Export the class for use in server.js
