// bilibili-rss.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * Class BilibiliRSS
 *
 * Simple class to fetch video data from Bilibili via scraping and convert to RSS feed
 */
class BilibiliRSS {
	/**
	 * BilibiliRSS constructor.
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
		const cachefile = path.join(dir, `bi_${this.id}.xml`);
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
	 * Fetches the data from Bilibili and cleans it up for our usecase
	 *
	 * @return {Promise<Object>}
	 */
	async getData() {
		const browser = await puppeteer.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-blink-features=AutomationControlled',
			],
		});
		const page = await browser.newPage();

		// Stealth: Hide webdriver and set real browser properties
		await page.evaluateOnNewDocument(() => {
			Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
		});
		await page.setUserAgent(
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
		);
		await page.setViewport({ width: 1280, height: 800 });

		await page.goto(`https://space.bilibili.com/${this.id}/video`, {
			waitUntil: 'domcontentloaded',
		});
		await page
			.waitForSelector('.upinfo-detail', { timeout: 60000 })
			.catch(() => {}); // Longer timeout for user info
		await page
			.waitForSelector('.video-list', { timeout: 60000 })
			.catch(() => {}); // Wait for video container

		const scraped = await page.evaluate(() => {
			const full_name = document.querySelector('.nickname')
				? document.querySelector('.nickname').textContent.trim()
				: 'Unknown User';
			const summary = document.querySelector('.pure-text')
				? document.querySelector('.pure-text').textContent.trim()
				: '';
			const posts = [];
			document.querySelectorAll('.upload-video-card').forEach((card) => {
				const titleA = card.querySelector('.bili-video-card__title a');
				const title = titleA ? titleA.textContent.trim() : '';
				const fullUrl = titleA ? 'https:' + titleA.getAttribute('href') : '';
				const url = fullUrl.split('?')[0];
				const date = card.querySelector('.bili-video-card__subtitle span')
					? card
							.querySelector('.bili-video-card__subtitle span')
							.textContent.trim()
					: '';
				const thumb_image_url = card.querySelector(
					'.bili-cover-card__thumbnail img'
				)
					? card
							.querySelector('.bili-cover-card__thumbnail img')
							.getAttribute('src')
					: '';
				posts.push({
					title,
					url,
					published_at: date,
					image: { thumb_image_url },
				});
			});
			return { full_name, summary, posts };
		});
		await browser.close();

		// Parse dates to ISO strings
		const currentYear = new Date().getFullYear();
		const currentMonth = new Date().getMonth() + 1;
		scraped.posts.forEach((post) => {
			let dateStr = post.published_at;
			let year = currentYear;
			if (dateStr.length <= 5) {
				// MM-DD or shorter; normalize
				const parts = dateStr.split('-').map((part) => part.padStart(2, '0'));
				dateStr = parts.join('-');
				const [month, day] = parts.map(Number);
				if (month > currentMonth) {
					year--;
				}
				dateStr = `${year}-${dateStr}`;
			} else if (dateStr.length === 10 && dateStr.startsWith('20')) {
				// YYYY-MM-DD
				// Use as is
			} else {
				dateStr = `${year}-01-01`; // Fallback for invalid
			}
			post.published_at = new Date(Date.parse(dateStr)).toISOString();
			// Normalize thumb_image_url
			if (post.image.thumb_image_url.startsWith('//')) {
				post.image.thumb_image_url = 'https:' + post.image.thumb_image_url;
			}
		});

		const clean = {
			posts: scraped.posts,
			user: {
				full_name: scraped.full_name,
				url: `https://space.bilibili.com/${this.id}`,
				image_url: '',
			},
			campaign: {
				summary:
					scraped.summary || `Videos from Bilibili user ${scraped.full_name}`,
			},
		};

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
		xml +=
			'<pubDate>' + new Date(item.published_at).toUTCString() + '</pubDate>\n';
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
			this.escapeXml(user.full_name || 'Unknown User') +
			' on Bilibili</title>\n';
		xml +=
			'<description>' +
			this.escapeXml(this.stripTags(campaign.summary || '')) +
			'</description>\n';
		xml += '<link>' + this.escapeXml(user.url || '') + '</link>\n';
		xml += '<language>en-US</language>\n';
		xml += '<generator>Bilibili RSS Generator v1.0</generator>\n';
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

module.exports = BilibiliRSS;
