const args = require("minimist")(process.argv.slice(2));

if (!args.config) throw new Error("Please specify a config with --config!");

const path = require("path");
const config = require("./config");
config.loadConfig(path.join(process.cwd(), args.config));

const fs = require("fs");
const marked = require("marked");
const frontMatter = require("front-matter");
const childProcess = require("child_process");
const ejs = require("ejs");

const fastify = require("fastify");

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

app.register(
	require("fastify-compress"),
	{ global: true }
);
app.register(require("fastify-auto-push").staticServe, {
	root: path.join(__dirname, "..", "static"),
});

processArticles();

function render(name, data) {
	return ejs.renderFile(path.join(__dirname, "..", "views", name), {
		months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul","Aug", "Sep", "Oct", "Nov", "Dec"],
		getSeries(series) {
			return articles.filter(_ => _.series === series).sort((a, b) => a.date_js - b.date_js, 0);
		},
		...data
	}, {
		cache: false
	});
}

app.get("/", (req, res) => {
	res.type("text/html").code(200);
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
	return render("search.ejs", {
		articles,

		query: req.query.q
	});
});

app.get("/advice", (req, res) => {
	res.type("text/html").code(200);
	return render("section.ejs", {
		articles,
		tag: "advice",

		title: "Advice",
		description: "Let us solve your many, many problems."
	});
});

app.get("/local", (req, res) => {
	res.type("text/html").code(200);
	return render("section.ejs", {
		articles,
		tag: "local",

		title: "Local",
		description: "Like gossip, but two weeks late!"
	});
});

app.get("/politics", (req, res) => {
	res.type("text/html").code(200);
	return render("section.ejs", {
		articles,
		tag: "politics",

		title: "Politics",
		description: "Piss off your extended family."
	});
});

app.get("/culture", (req, res) => {
	res.type("text/html").code(200);
	return render("section.ejs", {
		articles,
		tag: "culture",

		title: "Culture",
		description: "Half as much culture as your yogurt."
	});
});

app.get("/about", (req, res) => {
	res.type("text/html").code(200);
	return render("about.ejs");
});

app.get("/contact", (req, res) => {
	res.type("text/html").code(200);
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

app.listen(config().port, "0.0.0.0", (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.info(`server listening on ${address}!`);
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
