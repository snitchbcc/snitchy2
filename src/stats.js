const fs = require("fs");
const path = require("path");
const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

module.exports = () => {
    let stats = {};
    let lines = fs.readFileSync(path.join(__dirname, "..", "ana")).toString().split("\n");

    let currentDay = "";
    let currentDayTotalHits = 0;
    let currentDayIps = new Set();
    let currentDaySessions = new Set();
    let currentDayMostPopularArticles = {};

    function resetDay() {
        currentDayTotalHits = 0;
        currentDayIps = new Set();
        currentDaySessions = new Set();
        currentDayMostPopularArticles = {};
    }

    for (const line of lines) {
        let comp = line.split(" ");
        if (comp.length < 2) break;

        let date = comp[0];
        let ipAddress = comp[1];
        let session = comp[2];
        let pathname = comp[3];
        let referrer = comp[4];

        if (ipAddress.startsWith("66.249") || pathname.indexOf("/stats") !== -1 || pathname.indexOf("/content") !== -1) continue;
        if (pathname.startsWith("/article")) {
            let articlePathname = pathname.replace("/article/", "");

            if (!currentDayMostPopularArticles[articlePathname]) currentDayMostPopularArticles[articlePathname] = new Set();
            currentDayMostPopularArticles[articlePathname].add(session);
        }
        
        let jsDate = new Date(parseInt(date));
        let formattedDay = `${dayNames[jsDate.getDay()]}, ${monthNames[jsDate.getMonth()]} ${jsDate.getDate()}, ${jsDate.getFullYear()}`;

        if (currentDay !== formattedDay) {
            if (currentDay) {
                let k = Object.keys(currentDayMostPopularArticles).sort((a, b) => currentDayMostPopularArticles[b].size - currentDayMostPopularArticles[a].size)[0];

                stats[currentDay] = {
                    totalHits: currentDayTotalHits,
                    ipUniqueHits: currentDayIps.size,
                    sessionUniqueHits: currentDaySessions.size,
            
                    mostPopularArticle: k,
                    mostPopularArticleHits: currentDayMostPopularArticles[k].size
                };
            }

            currentDay = formattedDay;
            resetDay();
        }

        currentDayTotalHits++;
        currentDayIps.add(ipAddress);
        currentDaySessions.add(session);
    }

    return stats;
}
