function randomAd(idx) {
	var ad = document.createElement("img");
	ad.classList.add("articles-ad");
	ad.src = `/bigfunny/${ads[idx % ads.length]}`;
	ad.alt = "Big Funny Banner";
	return ad;
}

document.body.addEventListener("click", async event => {
	const target = event.target;

	if (target.classList.contains("articles-load_more")) {
		const articles = await (await fetch(`/query?q=${encodeURIComponent(target.parentElement.getAttribute("data-q"))}&g=${target.parentElement.querySelectorAll(".articles-list").length}`)).json();
		if (!articles.length) {
			target.remove();
			return;
		}

		let block = document.createElement("div");
		block.classList.add("articles-list");
		let first;
		for (const article of articles) {
			const article_el = document.createElement("a");

			article_el.href = `/article/${article.slug}`;
			if (article.tags.indexOf("cartoon") !== -1) article_el.className = "cartoon";
			article_el.innerHTML =
			`
			${article.thumbnail ? `<img src="${article.thumbnail}" alt="Thumbnail for ${article.title}" loading="lazy">` : ""}
			<div>
				<h3>${article.title}</h3>
				<span>${article.authors}</span>
			</div>
			`;

			// target.parentElement.children[0].appendChild(article_el);
			block.appendChild(article_el);
			
			if (!first) first = article_el;
		}

		target.parentElement.appendChild(block);
		if (target.parentElement.getAttribute("data-ads") === "yes") target.parentElement.appendChild(randomAd(
			target.parentElement.querySelectorAll(".articles-ad").length
		));
		target.parentElement.appendChild(target);

		first.scrollIntoView();
		scrollBy({
			top: -40
		});
	} else if (target.closest(".quiz-choices>*")) {
		[...target.closest(".quiz-choices").children].map(_ => _.classList.remove("selected"));
		target.closest(".quiz-choices>*").classList.add("selected");

		const all_qc = target.closest(".quiz").querySelectorAll(".quiz-choices");
		let values = {};
		for (const q of Object.keys(quiz.results)) values[q] = 0;
		for (const a of all_qc) {
			if (!a.querySelector(".quiz-choices .selected")) return;
			else {
				values[a.querySelector(".selected").getAttribute("data-score")] += 1;
			}
		}

		const total = quiz.style === "single-point" ? quiz.questions.length : undefined;
		let highest = {key: -10, value: -10};
		for (const key in values) {
			if (Object.hasOwnProperty.call(values, key)) {
				// console.log(`${key}: ${values[key]/total * 100}`);
				if (values[key] > highest.value) highest = {key: key, value: values[key]};
				document.querySelector(`.quiz-result[data-score=${key}] .progress-fill`).style.width = `${values[key]/total * 100}%`;
				document.querySelector(`.quiz-result[data-score=${key}] .progress-fill span`).innerText = `${Math.round(values[key]/total * 100)}%`;
			}
		}

		document.querySelector(".quiz-results-title").innerText = quiz.results[highest.key].title;
		document.querySelector(".quiz-results-description").innerText = quiz.results[highest.key].description;

		target.closest(".quiz").querySelector(".quiz-results").classList.add("visible");
	} else if (target.id === "theme_switcher") {
		document.body.classList.toggle("dark");
		if (target.innerText === "🌕") {
			target.innerText = "☀️";
			document.cookie ="theme=dark;path=/";
		} else {
			target.innerText = "🌕";
			document.cookie = "theme=light;path=/";
		}
	}
});
