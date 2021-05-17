const ejs = require("ejs");
const path = require("path");
const data = require("./data");
const utils = require("./utils");

module.exports = function render(name, req, inp) {
	return ejs.renderFile(path.join(__dirname, "..", "views", name), {
		ad_list: utils.shuffle(data.ads),
		ad_links: data.adLinks,
		dark: req.cookies.theme === "dark",

        req,
        ...inp,
		...utils
	}, {
		cache: false
	});
}
