const fs = require("fs");
const path = require("path");
const marked = require("marked");
const frontMatter = require("front-matter");
const childProcess = require("child_process");

const articlesRoot = path.join(__dirname, "..", "data", "articles");

function addTopics(tags) {
	for (const tag of tags) if (["latest", "series", "local", "politics", "culture", "best-of", "cartoon"].indexOf(tag) === -1) module.exports.topics.add(tag);
}

module.exports.ads = fs.readdirSync(path.join(__dirname, "..", "static", "bigfunny"));
module.exports.adLinks = JSON.parse(fs.readFileSync(path.join(__dirname, "ads.json")).toString());

function processArticles() {
	if (!fs.existsSync(path.join(__dirname, "..", "data"))) fs.mkdirSync(path.join(__dirname, "..", "data"));
	if (!fs.existsSync(articlesRoot)) childProcess.execSync("git clone https://github.com/snitchbcc/articles", {
		cwd: path.join(__dirname, "..", "data")
	});

	module.exports.articles = [];
	module.exports.topics = new Set();
	module.exports.series = JSON.parse(fs.readFileSync(path.join(articlesRoot, "series.json")).toString());
	module.exports.mapped_series = {};

	module.exports.ex_people = JSON.parse(fs.readFileSync(path.join(articlesRoot, "ex_people.json")).toString())
	module.exports.people = JSON.parse(fs.readFileSync(path.join(articlesRoot, "people.json")).toString());

	for (const ss of Object.keys(module.exports.series)) {
		module.exports.mapped_series[ss.toLowerCase().replace(/ /g, '-')] = ss;
	}

	for (const year of fs.readdirSync(articlesRoot).filter(_ => /^\+?\d+$/.test(_))) {
		for (const month of fs.readdirSync(path.join(articlesRoot, year))) {
			for (const article of fs.readdirSync(path.join(articlesRoot, year, month))) {
				switch (path.extname(article)) {
					case ".json":
						const data = JSON.parse(fs.readFileSync(path.join(articlesRoot, year, month, article)).toString());
						addTopics(data.tags);
						module.exports.articles.push({
							type: "quiz",

							slug: article.slice(0, article.length - 5),
							title: data.title,

							authors: data.authors,
							authorsText: data.authors_text || data.authors.join(", "),

							description: data.description,
							tags: data.tags,
							series: data.series,
							thumbnail: data.thumbnail ? (data.thumbnail.startsWith("content://") ? `https://images.snitchbcc.com/${data.thumbnail.slice(10)}` : data.thumbnail) : undefined,

							date: {
								year: parseInt(year),
								month: parseInt(month),
								day: data.date
							},
							date_js: new Date(parseInt(year), parseInt(month)-1, data.date),

							data
						});
						break;
					case ".md":
						const contents = fs.readFileSync(path.join(articlesRoot, year, month, article)).toString();
						const fm = frontMatter(contents);
						addTopics(fm.attributes.tags);
						module.exports.articles.push({
							type: "article",

							slug: article.slice(0, article.length - 3),
							title: fm.attributes.title,
							
							authors: fm.attributes.authors,
							authorsText: fm.attributes.authors_text || fm.attributes.authors.join(", "),

							description: fm.attributes.description,
							date: {
								year: parseInt(year),
								month: parseInt(month),
								day: fm.attributes.date
							},
							ribbon: fm.attributes.ribbon,
							thumbnail: fm.attributes.thumbnail ? (fm.attributes.thumbnail.startsWith("content://") ? `https://images.snitchbcc.com/${fm.attributes.thumbnail.slice(10)}` : fm.attributes.thumbnail) : undefined,
							date_js: new Date(parseInt(year), parseInt(month)-1, fm.attributes.date),
							tags: fm.attributes.tags,
							series: fm.attributes.series,
							body: fm.body,
							rendered: marked(fm.body),

							thumbnail_max_height: fm.attributes.thumbnail_max_height,
						});
						break;
					default:
						break;
				}
			}
		}
	}
}

module.exports.processArticles = processArticles;
