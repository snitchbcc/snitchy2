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

const fastify = require("fastify");
const pump = require("pump");

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
const articlesRoot = path.join(__dirname, "..", "data", "articles");
function processArticles() {
	if (!fs.existsSync(path.join(__dirname, "..", "data"))) fs.mkdirSync(path.join(__dirname, "..", "data"));
	if (!fs.existsSync(articlesRoot)) childProcess.execSync("git clone https://github.com/snitchbcc/articles", {
		cwd: path.join(__dirname, "..", "data")
	});
	articles = [];
	for (const year of fs.readdirSync(articlesRoot).filter(_ => _.startsWith("20"))) {
		for (const month of fs.readdirSync(path.join(articlesRoot, year))) {
			for (const article of fs.readdirSync(path.join(articlesRoot, year, month))) {
				const contents = fs.readFileSync(path.join(articlesRoot, year, month, article)).toString();
				const fm = frontMatter(contents);
				articles.push({
					slug: article.slice(0, article.length - 3),
					title: fm.attributes.title,
					authors: fm.attributes.authors,
					date: {
						year: parseInt(year),
						month: parseInt(month),
						day: fm.attributes.date
					},
					thumbnail: fm.attributes.thumbnail ? (fm.attributes.thumbnail.startsWith("content://") ? `/content/${fm.attributes.thumbnail.slice(10)}` : fm.attributes.thumbnail) : undefined,
					date_js: new Date(parseInt(year), parseInt(month), fm.attributes.date),
					tags: fm.attributes.tags,
					series: fm.attributes.series,
					body: fm.body,
					rendered: marked(fm.body)
				});
			}
		}
	}
}

const people = JSON.parse(fs.readFileSync(path.join(__dirname, "people.json")).toString());

app.register(
	require("fastify-compress"),
	{ global: true }
);
app.register(require("fastify-static").default, {
	root: path.join(__dirname, "..", "static"),
});
app.register(require("fastify-multipart"));

processArticles();

function render(name, data) {
	return ejs.renderFile(path.join(__dirname, "..", "views", name), {
		months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul","Aug", "Sep", "Oct", "Nov", "Dec"],
		getSeries(series) {
			return articles.filter(_ => _.series === series).sort((a, b) => a.date_js - b.date_js, 0);
		},
		quote (string) {
			return string.replace(/"/g, "&quot;");
		},
		...data
	}, {
		cache: false
	});
}

function push(req, res) {
	if (!req.raw.stream) return;

	// Fonts do weird flashy things in Chrome (crying emoji)
	// req.raw.stream.pushStream(
	// 	{ ":path": `/Inter-normal.woff2` },
	// 	(err, stream) => {
	// 		if (err) return;
	// 		stream.respondWithFile(path.join(__dirname, "../static/Inter-normal.woff2"), {
	// 		"content-type": "application/font-woff2",
	// 		"cache-control": "public, max-age=0"
	// 	});
	// }
	// );

	// req.raw.stream.pushStream(
	// 	{ ":path": `/style.css` },
	// 	(err, stream) => {
	// 		if (err) return;
	// 		stream.respondWithFile(path.join(__dirname, "../static/style.css"), {
	// 		"content-type": "text/css",
	// 		"cache-control": "public, max-age=0"
	// 	});
	// }
	// );

	req.raw.stream.pushStream(
		{ ":path": `/img/tophat.svg` },
		(err, stream) => {
			if (err) return;
			stream.respondWithFile(path.join(__dirname, "../static/img/tophat.svg"), {
			"content-type": "image/svg+xml",
			"cache-control": "public, max-age=0"
		});
	}
	);
}

app.get("/", (req, res) => {
	res.type("text/html").code(200);	
	push(req, res);
	return render("section.ejs", {
		articles,
		tag: "featured",

		title: "The Latest",
		description: "Democracy bumps into things in darkness."
	});
});

app.get("/search", (req, res) => {
	if (!req.query.q)
		return res.redirect("/");

	res.type("text/html").code(200);
	push(req, res);
	return render("search.ejs", {
		articles,

		query: req.query.q
	});
});

app.get("/advice", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", {
		articles,
		tag: "advice",

		title: "Advice",
		description: "Let us solve your many, many problems."
	});
});

app.get("/local", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", {
		articles,
		tag: "local",

		title: "Local",
		description: "Like gossip, but two weeks late!"
	});
});

app.get("/politics", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", {
		articles,
		tag: "politics",

		title: "Politics",
		description: "Piss off your extended family."
	});
});

app.get("/culture", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("section.ejs", {
		articles,
		tag: "culture",

		title: "Culture",
		description: "Half as much culture as your yogurt."
	});
});

app.get("/about", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("about.ejs", {
		people
	});
});

app.get("/contact", (req, res) => {
	res.type("text/html").code(200);
	push(req, res);
	return render("contact.ejs");
});

app.get("/discord", (req, res) => {
	res.redirect("https://discord.gg/GxkM9bu");
});

app.get("/article/:slug", (req, res) => {
	const article = articles.find(_ => _.slug === req.params.slug);
	if (!article) return res.redirect("/");

	res.type("text/html").code(200);
	return render("article.ejs", {
		article
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
