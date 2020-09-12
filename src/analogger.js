const fs = require("fs");
const path = require("path");

if (!fs.existsSync(path.join(__dirname, "..", "ana"))) fs.writeFileSync(path.join(__dirname, "..", "ana"), "");
const ana = fs.openSync(path.join(__dirname, "..", "ana"), 'a');

module.exports = function (ip, session, url, referrer) {
	fs.appendFileSync(ana, `${+new Date()} ${ip} ${session} ${encodeURI(url)}${referrer ? " " + encodeURI(referrer) : ""}\n`);
}
