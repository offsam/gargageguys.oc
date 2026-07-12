(function () {
  const plaques = document.querySelectorAll('.deal-plaque');

  plaques.forEach((plaque) => {
    const trigger = plaque.querySelector('.deal-plaque__trigger');
    const reveal = plaque.querySelector('.deal-plaque__reveal');
    if (!trigger || !reveal) return;

    trigger.addEventListener('click', () => {
      const willOpen = !plaque.classList.contains('is-open');

      plaques.forEach((other) => {
        if (other === plaque) return;
        other.classList.remove('is-open');
        const otherTrigger = other.querySelector('.deal-plaque__trigger');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      });

      plaque.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });
})();
