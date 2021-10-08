module.exports = {
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul","Aug", "Sep", "Oct", "Nov", "Dec"],
    
    shuffle(a) {
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
    },
    getPath(req) {
        return new URL(req.url, "https://snitchbcc.com").pathname;
    },
    quote(string) {
        return string.replace(/"/g, "&quot;");
    },
    capitalize(word) {
        return word.slice(0, 1).toUpperCase() + word.slice(1);
    },
    slugToTitle(slug) {
        let title = "";
        for (const part of slug.split("-")) title += this.capitalize(part) + " ";
        return title.trim();
    },
    formatDate(date) {
        return `${this.months[date.month - 1]} ${date.day}, ${date.year}`;
    },

    queryArticles(articles, query) {
        if (query.startsWith("#")) {
            if (query.slice(1) === "featured") return articles;
            return articles.filter(_ => _.tags.indexOf(query.slice(1)) !== -1);
        } else if (query.startsWith(":")) {
            return articles.filter(_ => _.series === query.slice(1));
        }
    
        return articles.filter(_ => _.title.toLowerCase().indexOf(query.toLowerCase()) !== -1 || _.authors.join(", ").toLowerCase().indexOf(query.toLowerCase()) !== -1);
    },
    sortByDate(articles) {
        return articles.sort((a, b) => b.date_js - a.date_js, 0);
    },
    getSeries(articles, series) {
        return articles.filter(_ => _.series === series).sort((a, b) => b.date_js - a.date_js, 0);
    },
    firstTag(article) {
        if (!article.tags[0]) return;
        return article.tags[0];
    },
    getRecommended(articles, article) {
        const priority_tag = this.firstTag(article);
        return this.sortByDate(articles).filter(_ => _.slug !== article.slug && this.firstTag(_) === priority_tag);
    },
};
