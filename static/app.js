document.body.addEventListener("click", async event => {
	const target = event.target;

	if (target.classList.contains("articles-load_more")) {
		const articles = await (await fetch(`/query?q=${encodeURIComponent(target.parentElement.getAttribute("data-q"))}&g=${target.parentElement.children[0].children.length/6}`)).json();
		if (!articles.length) {
			target.remove();
			return;
		}

		let first;
		for (const article of articles) {
			const article_el = document.createElement("a");

			article_el.innerHTML =
			`
			${article.thumbnail ? `<img src="${article.thumbnail}" alt="Thumbnail for ${article.title}" loading="lazy">` : ""}
			<div>
				<h3>${article.title}</h3>
				<span>${article.authors}</span>
			</div>
			`;

			target.parentElement.children[0].appendChild(article_el);
			if (!first) first = article_el;
		}

		first.scrollIntoView();
		scrollBy({
			top: -40
		});
	}
});
