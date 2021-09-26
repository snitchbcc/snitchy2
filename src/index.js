const args = require("minimist")(process.argv.slice(2));

if (!args.config) throw new Error("Please specify a config with --config!");
if (!args.code) throw new Error("Please specify a content code with --code!");

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const pump = require("pump");
const fastify = require("fastify");
const childProcess = require("child_process");

const data = require("./data");
const utils = require("./utils");
const stats = require("./stats");
const config = require("./config");
const render = require("./render");
const analogger = require("./analogger");

config.loadConfig(path.join(process.cwd(), args.config));

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
		data.processArticles();
		console.log(`New out: ${out}`);
	} catch (err) {
		console.error(`Encountered error: ${err}`);
	}
}, 30000);

data.processArticles();

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
	if (req.url.indexOf(".") !== -1 || req.url.indexOf("preview") !== -1) return next();
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

data.processArticles();

function push(req, res) {
	if (!req.raw.stream) return;
}

app.get("/", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles: data.articles,
		tag: "featured",

		title: "The Latest",
		description: "No constraints, no limits, no standards."
	});
});

app.get("/preview/:id", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("preview.ejs", req, {
		id: req.params.id
	});
});

app.get("/contest", (req, res) => {
	res.redirect("https://docs.google.com/document/d/1_bfzbyQmubnQGFD0hOUergsJQ86iX0se8hJi4e5SWj8/edit#");
	return;
});

app.get("/search", (req, res) => {
	if (!req.query.q)
		return res.redirect("/");

	res.type("text/html").code(200);
	push(req, res);
	return render("search.ejs", req, {
		articles: data.articles,

		query: req.query.q
	});
});

app.get("/series", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("series.ejs", req, {
		articles: data.articles,
		series: data.series
	});
});

app.get("/series/:series", (req, res) => {
	// console.log(series);
	if (!(req.params.series in data.mapped_series)) {
		res.type("text/html").code(404);
		return render("404.ejs", req, {});
	}

	res.type("text/html").code(200);
	push(req, res);
	return render("series_section.ejs", req, {
		articles: data.articles,
		series: data.series,
		title: data.mapped_series[req.params.series]
	});
});

app.get("/local", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles: data.articles,
		tag: "local",

		title: "Local",
		description: "Like gossip, but two weeks late!"
	});
});

app.get("/politics", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles: data.articles,
		tag: "politics",

		title: "Politics",
		description: "Piss off your extended family."
	});
});

app.get("/topics", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("topics.ejs", req, {
		articles: data.articles,
		topics: data.topics
	});
});

app.get("/topic/:topic", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("topic.ejs", req, {
		articles: data.articles,
		topic: req.params.topic
	});
});

app.get("/culture", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles: data.articles,
		tag: "culture",

		title: "Culture",
		description: "Half as much culture as your yogurt."
	});
});


app.get("/best-of", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", req, {
		articles: data.articles,
		tag: "best-of",

		title: "Best Of",
		description: "Our best articles."
	});
});

app.get("/about", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("about.ejs", req, {
		people: data.people,
		articles: data.articles
	});
});

app.get("/our-history", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("history.ejs", req, {
		people: data.ex_people
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
	const article = data.articles.find(_ => _.slug === req.params.slug);
	push(req, res);
	if (!article) {
		res.type("text/html").code(404);
		return render("404.ejs", req, {});
	}

	res.type("text/html").code(200);
	switch (article.type) {
		case "article":
			return render("article.ejs", req, {
				article,
				articles: data.articles
			});

		case "quiz":
			return render("quiz.ejs", req, {
				quiz: article,
				articles: data.articles
			});

		default:
			return "joe mama";
	}
});

app.get("/query", (req, res) => {
	if (typeof req.query.q !== "string") return {error: "query parameter 'q' must be string!"}
	
	const articles = utils.sortByDate(utils.queryArticles(data.articles, req.query.q)).map(_ => ({
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
		articles: data.articles
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
const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
