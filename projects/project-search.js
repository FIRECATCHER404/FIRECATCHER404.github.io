const form = document.querySelector(".project-search");
const input = document.getElementById("project-search");
const status = document.getElementById("project-search-status");
const empty = document.getElementById("project-search-empty");
const normalize = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const categories = [...document.querySelectorAll("#project-results .category")].map(section => {
  const category = section.querySelector("h2").textContent;
  return {
    section,
    count: section.querySelector(".category-count"),
    cards: [...section.querySelectorAll(".project-link")].map(card => ({
      card,
      text: normalize(`${category} ${card.textContent} ${card.querySelector("img")?.alt || ""}`)
    }))
  };
});
const total = categories.reduce((sum, category) => sum + category.cards.length, 0);

function filterProjects() {
  const terms = normalize(input.value).trim().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const category of categories) {
    let matches = 0;
    for (const { card, text } of category.cards) {
      card.hidden = !terms.every(term => text.includes(term));
      if (!card.hidden) matches += 1;
    }
    category.section.hidden = matches === 0;
    category.count.textContent = `${matches} ${matches === 1 ? "project" : "projects"}`;
    visible += matches;
  }
  empty.hidden = visible !== 0;
  status.textContent = terms.length ? `${visible} of ${total} projects` : `${total} projects`;
}

input.addEventListener("input", filterProjects);
input.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  input.value = "";
  filterProjects();
});
form.addEventListener("submit", event => { event.preventDefault(); filterProjects(); });
filterProjects();
form.hidden = false;
