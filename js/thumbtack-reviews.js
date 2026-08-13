(function () {
  function setText(selector, text) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = text;
    });
  }

  function applyCounts(ttCount, googleCount) {
    if (ttCount && ttCount > 0) {
      setText("[data-tt-reviews]", ttCount + " Reviews");
      setText("[data-tt-reviews-title]", ttCount + " Reviews");
      document.querySelectorAll(".stat-review-side[aria-label*='Thumbtack']").forEach(function (el) {
        el.setAttribute("aria-label", ttCount + " Thumbtack reviews");
      });
      document.querySelectorAll('a.reviews-thumbtack-link[href*="thumbtack.com"]').forEach(function (el) {
        el.textContent = el.textContent.replace(/\d+\s+reviews/, ttCount + " reviews");
      });
    }

    if (googleCount && googleCount > 0) {
      setText("[data-google-reviews]", googleCount + " Reviews");
      setText("[data-google-reviews-title]", googleCount + " Reviews");
      document.querySelectorAll(".stat-review-side[aria-label*='Google']").forEach(function (el) {
        el.setAttribute("aria-label", googleCount + " Google reviews");
      });
      document.querySelectorAll('a.reviews-thumbtack-link[href*="maps.app.goo.gl"]').forEach(function (el) {
        el.textContent = el.textContent.replace(/\d+\s+reviews/, googleCount + " reviews");
      });
    }
  }

  Promise.all([
    fetch("/api/reviews")
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      }),
    fetch("/api/thumbtack-reviews")
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      }),
  ]).then(function (results) {
    var reviews = results[0] || {};
    var thumbtack = results[1] || {};
    var tt =
      (reviews.aggregates && reviews.aggregates.thumbtack && reviews.aggregates.thumbtack.count) ||
      thumbtack.reviewCount ||
      null;
    var google =
      (reviews.aggregates && reviews.aggregates.google && reviews.aggregates.google.count) || null;
    applyCounts(Number(tt), Number(google));
  });
})();
