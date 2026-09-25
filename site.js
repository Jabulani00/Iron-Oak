(function () {
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    const bars = menuBtn.querySelectorAll('span');
    function closeMenu() {
      mobileMenu.classList.remove('open');
      if (!bars.length) return;
      bars[0].style.transform = '';
      bars[1].style.opacity = '1';
      bars[2].style.transform = '';
    }
    menuBtn.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      bars[0].style.transform = open ? 'translateY(6px) rotate(45deg)' : '';
      bars[1].style.opacity = open ? '0' : '1';
      bars[2].style.transform = open ? 'translateY(-6px) rotate(-45deg)' : '';
    });
    document.querySelectorAll('.mobnav').forEach((link) => link.addEventListener('click', closeMenu));
  }

  const navPill = document.getElementById('navPill');
  if (navPill) {
    const onScroll = () => {
      if (window.scrollY > 40) {
        navPill.classList.add('scrolled');
        navPill.style.transform = 'scale(.97)';
      } else {
        navPill.classList.remove('scrolled');
        navPill.style.transform = 'scale(1)';
      }
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => io.observe(el));

  function setConsent(value) {
    localStorage.setItem('ironoak_cookie', value);
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.add('hidden');
  }
  const accept = document.getElementById('cookieAccept');
  const essential = document.getElementById('cookieEssential');
  if (accept) accept.addEventListener('click', () => setConsent('all'));
  if (essential) essential.addEventListener('click', () => setConsent('essential'));
  const reset = document.getElementById('cookieReset');
  if (reset) {
    reset.addEventListener('click', () => {
      localStorage.removeItem('ironoak_cookie');
      const banner = document.getElementById('cookieBanner');
      if (banner) banner.classList.remove('hidden');
    });
  }
  if (!localStorage.getItem('ironoak_cookie')) {
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.remove('hidden');
  }

  function closePopup() {
    const popup = document.getElementById('popup');
    if (!popup) return;
    try { sessionStorage.setItem('ironoak_offer_closed', '1'); } catch (err) {}
    popup.remove();
  }
  const popup = document.getElementById('popup');
  if (popup) {
    let closed = false;
    try { closed = sessionStorage.getItem('ironoak_offer_closed') === '1'; } catch (err) {}
    if (closed) {
      popup.remove();
    } else {
      const closeBtn = document.getElementById('popupClose');
      if (closeBtn) closeBtn.addEventListener('click', closePopup);
      const book = document.getElementById('popupBook');
      if (book) {
        book.addEventListener('click', () => {
          closePopup();
          location.href = 'booking.html';
        });
      }
      popup.addEventListener('click', (event) => {
        if (event.target === popup) closePopup();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('popup')) closePopup();
      });
    }
  }
})();
