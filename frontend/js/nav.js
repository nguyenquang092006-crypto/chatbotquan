(function initNav() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  const links = nav.querySelectorAll('.site-nav-link');
  const isAboutPage = document.body.classList.contains('about-page');

  function setActive(navId) {
    links.forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === navId);
    });
  }

  setActive(isAboutPage ? 'tac-gia' : 'chatbot');
})();
