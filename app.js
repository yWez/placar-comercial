const revealItems = Array.from(document.querySelectorAll(".reveal"));

const showItem = (item) => {
  item.classList.add("is-visible");
};

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      showItem(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.08,
    rootMargin: "0px 0px 12% 0px",
  });

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 70, 210)}ms`;
    observer.observe(item);
  });
} else {
  revealItems.forEach(showItem);
}

requestAnimationFrame(() => {
  revealItems
    .filter((item) => item.getBoundingClientRect().top < window.innerHeight)
    .forEach(showItem);
});
