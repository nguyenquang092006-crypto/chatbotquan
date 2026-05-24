(function initMobile() {
  function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  }

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 100));

  const searchInput = document.getElementById('searchInput');
  if (searchInput && window.matchMedia('(max-width: 768px)').matches) {
    searchInput.placeholder = 'Tìm sách, tác giả, ISBN...';
  }
})();
