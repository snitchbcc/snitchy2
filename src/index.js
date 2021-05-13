const args = require("minimist")(process.argv.slice(2));

if (!args.config) throw new Error("Please specify a config with --config!");
if (!args.code) throw new Error("Please specify a content code with --code!");

const path = require("path");
const config = require("./config");
config.loadConfig(path.join(process.cwd(), args.config));

const fs = require("fs");
const marked = require("marked");
const frontMatter = require("front-matter");
const childProcess = require("child_process");
const ejs = require("ejs");
const zlib = require("zlib");

const fastify = require("fastify");
const pump = require("pump");
const analogger = require("./analogger");

if (config().https) console.log("Detected HTTPS in config! Enabling HTTPS and HTTP/2.0!");
const app = fastify(config().https ? {
	http2: true,
	https: {
		allowHTTP1: true,
		key: fs.readFileSync(config().https.key),
		cert: fs.readFileSync(config().https.cert),
		ca: config().https.chain ? fs.readFileSync(config().https.chain) : undefined
	}
} : {});

setInterval(() => {
	try {
		const out = childProcess.execSync("git pull", {
			cwd: path.join(__dirname, "..", "data", "articles")
		});

		if (out.indexOf("Already up to date.") !== -1) return;
		processArticles();
		console.log(`New out: ${out}`);
	} catch (err) {
		console.error(`Encountered error: ${err}`);
	}
}, 30000);

var articles = [];
var series = {};
var mapped_series = {};
var people = [];

const articlesRoot = path.join(__dirname, "..", "data", "articles");
function processArticles() {
	if (!fs.existsSync(path.join(__dirname, "..", "data"))) fs.mkdirSync(path.join(__dirname, "..", "data"));
	if (!fs.existsSync(articlesRoot)) childProcess.execSync("git clone https://github.com/snitchbcc/articles", {
		cwd: path.join(__dirname, "..", "data")
	});
	articles = [];
	series = JSON.parse(fs.readFileSync(path.join(articlesRoot, "series.json")).toString());
	mapped_series = {};
	people = JSON.parse(fs.readFileSync(path.join(articlesRoot, "people.json")).toString());

	for (const ss of Object.keys(series)) {
		mapped_series[ss.toLowerCase().replace(/ /g, '-')] = ss;
	}

	for (const year of fs.readdirSync(articlesRoot).filter(_ => /^\+?\d+$/.test(_))) {
		for (const month of fs.readdirSync(path.join(articlesRoot, year))) {
			for (const article of fs.readdirSync(path.join(articlesRoot, year, month))) {
				switch (path.extname(article)) {
					case ".json":
						const data = JSON.parse(fs.readFileSync(path.join(articlesRoot, year, month, article)).toString());
						articles.push({
							type: "quiz",

							slug: article.slice(0, article.length - 5),
							title: data.title,
							authors: data.authors,
							description: data.description,
							tags: data.tags,
							series: data.series,
							thumbnail: data.thumbnail ? (data.thumbnail.startsWith("content://") ? `/content/${data.thumbnail.slice(10)}` : data.thumbnail) : undefined,

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
						articles.push({
							type: "article",

							slug: article.slice(0, article.length - 3),
							title: fm.attributes.title,
							authors: fm.attributes.authors,
							description: fm.attributes.description,
							date: {
								year: parseInt(year),
								month: parseInt(month),
								day: fm.attributes.date
							},
							ribbon: fm.attributes.ribbon,
							thumbnail: fm.attributes.thumbnail ? (fm.attributes.thumbnail.startsWith("content://") ? `/content/${fm.attributes.thumbnail.slice(10)}` : fm.attributes.thumbnail) : undefined,
							date_js: new Date(parseInt(year), parseInt(month)-1, fm.attributes.date),
							tags: fm.attributes.tags,
							series: fm.attributes.series,
							body: fm.body,
							rendered: marked(fm.body)
						});
						break;
					default:
						break;
				}
			}
		}
	}
}

const adLinks = JSON.parse(fs.readFileSync(path.join(__dirname, "ads.json")).toString());

app.register(
	require("fastify-compress"),
	{
		global: true,
		brotliOptions: {
			params: {
				[zlib.constants.BROTLI_PARAM_QUALITY]: 4,
			},
		}
	}
);
app.register(require("fastify-static").default, {
	root: path.join(__dirname, "..", "static"),
});
app.register(require("fastify-multipart"));
app.register(require("fastify-cookie"), {});

app.addHook("onRequest", (req, res, next) => {
	if (req.url.indexOf(".") !== -1) return next();
	var sess = req.cookies.session || Math.random().toString(36).replace("0.", "");
	if (!req.cookies.session) res.setCookie("session", sess, {path: "/"});
	res.pouch = {ip: req.ip, session: sess};
	next();
});

app.addHook("onResponse", (req, res, next) => {
	if (!res.pouch || res.statusCode !== 200) return next();
	analogger(res.pouch.ip, res.pouch.session, req.url, req.headers["referer"]);
	next();
});

processArticles();
const ads = fs.readdirSync(path.join(__dirname, "..", "static", "bigfunny"));

function shuffle(a) {
	var array = a.map(_ => _);
	var currentIndex = array.length, temporaryValue, randomIndex;
  
	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
  
	  // Pick a remaining element...
	  randomIndex = Math.floor(Math.random() * currentIndex);
	  currentIndex -= 1;
  
	  // And swap it with the current element.
	  temporaryValue = array[currentIndex];
	  array[currentIndex] = array[randomIndex];
	  array[randomIndex] = temporaryValue;
	}
  
	return array;
}

function render(name, req, data) {
	return ejs.renderFile(path.join(__dirname, "..", "views", name), {
		months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul","Aug", "Sep", "Oct", "Nov", "Dec"],
		sortByDate(articles) {
			return articles.sort((a, b) => b.date_js - a.date_js, 0);
		},
		getSeries(series) {
			return articles.filter(_ => _.series === series).sort((a, b) => b.date_js - a.date_js, 0);
		},
		firstTag(article) {
			if (!article.tags[0]) return;
			return article.tags[0];
		},
		getRecommended(article) {
			const priority_tag = this.firstTag(article);
			return this.sortByDate(articles).filter(_ => _.slug !== article.slug && this.firstTag(_) === priority_tag);
		},
		quote (string) {
			return string.replace(/"/g, "&quot;");
		},
		shuffle,
		queryArticles,
		ad_list: shuffle(ads),
		ad_links: adLinks,
		dark: req.cookies.theme === "dark",
		...data
	}, {
		cache: false
	});
}

function push(req, res) {
	if (!req.raw.stream) return;
}

function queryArticles(query) {
	if (query.startsWith("#")) {
		if (query.slice(1) === "featured") return articles;
		return articles.filter(_ => _.tags.indexOf(query.slice(1)) !== -1);
	} else if (query.startsWith(":")) {
		return articles.filter(_ => _.series === query.slice(1));
	}

	return articles.filter(_ => _.title.toLowerCase().indexOf(query.toLowerCase()) !== -1 || _.authors.toLowerCase().indexOf(query.toLowerCase()) !== -1);
}

app.get("/", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles,
		tag: "featured",

		title: "The Latest",
		description: "Democracy bumps into things in darkness."
	});
});

app.get("/contest", (req, res) => {
	res.redirect("https://docs.google.com/document/d/1_bfzbyQmubnQGFD0hOUergsJQ86iX0se8hJi4e5SWj8/edit#");
});

app.get("/search", (req, res) => {
	if (!req.query.q)
		return res.redirect("/");

	res.type("text/html").code(200);
	push(req, res);
	return render("search.ejs", req, {
		articles,

		query: req.query.q
	});
});

app.get("/series", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("series.ejs", req, {
		series
	});
});

app.get("/series/:series", (req, res) => {
	// console.log(series);
	if (!(req.params.series in mapped_series)) {
		res.type("text/html").code(404);
		return render("404.ejs", req, {});
	}

	res.type("text/html").code(200);
	push(req, res);
	return render("series_section.ejs", req, {
		series,
		title: mapped_series[req.params.series]
	});
});

app.get("/local", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles,
		tag: "local",

		title: "Local",
		description: "Like gossip, but two weeks late!"
	});
});

app.get("/politics", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles,
		tag: "politics",

		title: "Politics",
		description: "Piss off your extended family."
	});
});

app.get("/culture", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles,
		tag: "culture",

		title: "Culture",
		description: "Half as much culture as your yogurt."
	});
});


app.get("/best-of", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles,
		tag: "best-of",

		title: "Best Of",
		description: "Our best articles."
	});
});

app.get("/about", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("about.ejs", req, {
		people,
		articles
	});
});

app.get("/contact", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("contact.ejs", req);
});

app.get("/discord", (req, res) => {
	res.redirect("https://discord.gg/GxkM9bu");
});

app.get("/article/:slug", (req, res) => {
	const article = articles.find(_ => _.slug === req.params.slug);
	push(req, res);
	if (!article) {
		res.type("text/html").code(404);
		return render("404.ejs", req, {});
	}

	res.type("text/html").code(200);
	switch (article.type) {
		case "article":
			return render("article.ejs", req, {
				article
			});

		case "quiz":
			return render("quiz.ejs", req, {
				quiz: article
			});

		default:
			return "joe mama";
	}
});

app.get("/query", (req, res) => {
	if (typeof req.query.q !== "string") return {error: "query parameter 'q' must be string!"}

	const articles = queryArticles(req.query.q).sort((a, b) => b.date_js - a.date_js, 0).map(_ => ({
		slug: _.slug,
		title: _.title,
		authors: _.authors,
		thumbnail: _.thumbnail,
		tags: _.tags
	}));
	return !isNaN(parseInt(req.query.g)) ? articles.slice(req.query.g * 6, req.query.g * 6 + 6) : articles.slice(0, 6);
});

app.get("/sitemap.xml", (req, res) => {
	res.type("text/xml").code(200);
	return render("sitemap.ejs", req, {
		articles
	});
});

const XXH = require("xxhashjs");
const content_root = path.join(__dirname, "..", "static", "content");
app.get("/content", async (req, res) => {
	let f = [];
	const H = XXH.h64( 0xABCD );
	for (const file of fs.readdirSync(content_root)) {
		f.push(new Promise(resolve => {
			fs.readFile(path.join(content_root, file), (err, data) => {
				resolve([file, H.update([...data].map(_ => String.fromCharCode(_)).join("")).digest().toString("16")]);
			});
		}));
	}
	return (await Promise.all(f)).reduce((a, b) => {a[b[0]] = b[1]; return a;}, {});;
});

const url = require("url");
const { getServers } = require("dns");
const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
app.get("/contest", (req, res) => {
	res.redirect("https://docs.google.com/document/d/1_bfzbyQmubnQGFD0hOUergsJQ86iX0se8hJi4e5SWj8/edit");
	return;
});
app.get("/stats", (req, res) => {
	if (req.query.code !== args.code) {
		console.log(`Invalid content code - got: ${req.query.code}, expected: ${args.code}`);
		res.code(401).send(new Error("Invalid code"));
		return;
	}

	let day = -1;
	let days = {};
	let articles = {};
	let lines = fs.readFileSync(path.join(__dirname, "..", "ana")).toString().split("\n");
	for (const line of lines) {
		let comp = line.split(" ");
		if (comp.length < 2) break;
		if (comp[3].indexOf("/stats") !== -1 || comp[3].indexOf("/content") !== -1) continue;
		if (comp[3].startsWith("/article")) {
			let a = url.parse(comp[3]).pathname;
			if (!articles[a]) articles[a] = new Set();
			articles[a].add(comp[1]);
		}

		let date = new Date(parseInt(comp[0]));
		// let ds = date.toLocaleDateString("EN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
		let ds = `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

		if (!days[ds]) days[ds] = {total: 0, unique: new Set()};
		days[ds].total += 1;
		days[ds].unique.add(comp[1]);

		if (ds !== day) {
			if (day !== -1) {
				days[day].unique = days[day].unique.size;
				days[day].article = Object.keys(articles).sort((a, b) => articles[b].size-articles[a].size)[0];
				days[day].article_count = articles[days[day].article].size;
				articles = {};
			}
			day = ds;
		}
	}
	days[day].unique = days[day].unique.size;
	days[day].article = Object.keys(articles).sort((a, b) => articles[b].size-articles[a].size)[0];
	days[day].article_count = articles[days[day].article].size;

	return days;
});

app.post("/content", (req, res) => {
	if (!req.isMultipart()) {
		reply.code(400).send(new Error("Request is not multipart"));
		return;
	}
		
	if (req.query.code !== args.code) {
		console.log(`Invalid content code - got: ${req.query.code}, expected: ${args.code}`);
		res.code(401).send(new Error("Invalid code"));
		return;
	}

	req.multipart(handler, onEnd);

	function onEnd() {
		console.log("upload completed");
		res.code(200).send();
	}

	function handler (field, file, filename, encoding, mimetype) {
		console.log(filename);
		pump(file, fs.createWriteStream(path.join(content_root, filename)));
	}
});

app.setNotFoundHandler((req, res) => {
	push(req, res);
	res.type("text/html").code(404);
	return render("404.ejs", req, {});
});

app.listen(config().port, "0.0.0.0", (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.info(`server listening on ${address}!`);
});

process.on("uncaughtException", err => {
	console.error(err);
});

if (config().redirect_from_http)
require("http")
.createServer(function(req, res) {
  const {
	headers: { host },
	url
  } = req;      
  if (host) {
	const redirectUrl = `https://${host.split(":")[0]}${url}`;
	res.writeHead(301, {
	  Location: redirectUrl
	});
	res.end();
  }
})
.listen(80);
