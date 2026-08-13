(function () {
  function applyReviewCount(n) {
    if (!n || n < 1) return;

    document.querySelectorAll(".stat-item--reviews .stat-label").forEach(function (el) {
      el.textContent = el.textContent.replace(/\d+\s+Reviews/, n + " Reviews");
    });

    document.querySelectorAll(".reviews-slider-title").forEach(function (el) {
      el.innerHTML = el.innerHTML.replace(/\d+\s+Reviews/, n + " Reviews");
    });

    document.querySelectorAll(".reviews-thumbtack-link").forEach(function (el) {
      el.textContent = el.textContent.replace(/\d+\s+reviews/, n + " reviews");
    });
  }

  fetch("/api/thumbtack-reviews")
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (data && data.reviewCount) applyReviewCount(Number(data.reviewCount));
    })
    .catch(function () {});
})();
