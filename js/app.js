(function () {
'use strict';

// ========== NAVIGATION ==========
var nav = document.getElementById('nav');
var hamburger = document.getElementById('hamburger');
var navLinks = document.getElementById('navLinks');

function updateNav() {
  if (!nav) return;
  if (window.scrollY > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

if (hamburger && navLinks) {
  hamburger.addEventListener('click', function () {
    var isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

// ========== SMOOTH SCROLL ==========
document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener('click', function (e) {
    var href = this.getAttribute('href');
    if (href === '#') return;
    var target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.querySelectorAll('[data-scroll-to]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    var targetId = this.getAttribute('data-scroll-to');
    var target = document.getElementById(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
});

// ========== INTERSECTION OBSERVER ANIMATIONS ==========
var animateEls = document.querySelectorAll('[data-animate]');
if (animateEls.length > 0 && 'IntersectionObserver' in window) {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  animateEls.forEach(function (el) { observer.observe(el); });
} else {
  animateEls.forEach(function (el) { el.classList.add('animate-in'); });
}

// ========== STAGGER ANIMATION OBSERVER ==========
var staggerEls = document.querySelectorAll('[data-animate-stagger]');
function revealStaggerChildren(el) {
  if (el.dataset.staggerRevealed) return;
  el.dataset.staggerRevealed = '1';
  var children = el.children;
  for (var i = 0; i < children.length; i++) {
    children[i].style.transitionDelay = (i * 0.1) + 's';
    children[i].classList.add('animate-in');
  }
}
if (staggerEls.length > 0 && 'IntersectionObserver' in window) {
  var staggerObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        revealStaggerChildren(entry.target);
        staggerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px 0px 0px' });
  staggerEls.forEach(function (el) { staggerObserver.observe(el); });
  // Fallback: reveal all stagger sections after 3s to prevent invisible content
  setTimeout(function () {
    staggerEls.forEach(function (el) { revealStaggerChildren(el); });
  }, 3000);
} else {
  staggerEls.forEach(function (el) { revealStaggerChildren(el); });
}

// ========== DATE PICKER CONSTRAINTS ==========
var today = new Date().toISOString().split('T')[0];
var checkinInput = document.getElementById('bb-checkin');
var checkoutInput = document.getElementById('bb-checkout');

if (checkinInput) {
  checkinInput.min = today;
  checkinInput.addEventListener('change', function () {
    if (checkoutInput) {
      var checkin = new Date(this.value);
      checkin.setDate(checkin.getDate() + 1);
      checkoutInput.min = checkin.toISOString().split('T')[0];
      if (checkoutInput.value && checkoutInput.value <= this.value) {
        checkoutInput.value = checkoutInput.min;
      }
    }
  });
}

// ========== ROOM CARD GALLERY ==========
document.querySelectorAll('[data-room-gallery]').forEach(function (gallery) {
  var img = gallery.querySelector('img');
  if (!img) return;

  var images;
  try {
    images = JSON.parse(img.getAttribute('data-images') || '[]');
  } catch (e) {
    images = [img.src];
  }

  if (images.length <= 1) {
    gallery.querySelectorAll('.room-gallery-nav').forEach(function (btn) { btn.style.display = 'none'; });
    return;
  }

  var currentIndex = 0;
  var dotsContainer = gallery.querySelector('.room-gallery-dots');

  // Build dots
  if (dotsContainer) {
    images.forEach(function (_, i) {
      var dot = document.createElement('span');
      dot.className = 'room-gallery-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', function (e) {
        e.stopPropagation();
        goTo(i);
      });
      dotsContainer.appendChild(dot);
    });
  }

  function goTo(index) {
    currentIndex = index;
    img.src = images[index];
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.room-gallery-dot').forEach(function (dot, i) {
        dot.classList.toggle('active', i === index);
      });
    }
  }

  var prevBtn = gallery.querySelector('.room-gallery-prev');
  var nextBtn = gallery.querySelector('.room-gallery-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      goTo((currentIndex - 1 + images.length) % images.length);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      goTo((currentIndex + 1) % images.length);
    });
  }

  // Touch swipe support
  var touchStartX = 0;
  gallery.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  gallery.addEventListener('touchend', function (e) {
    var diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goTo((currentIndex + 1) % images.length);
      } else {
        goTo((currentIndex - 1 + images.length) % images.length);
      }
    }
  }, { passive: true });
});

// ========== LIGHTBOX ==========
var lightbox = document.getElementById('lightbox');
var lightboxImg = document.getElementById('lightboxImg');
var lightboxClose = document.getElementById('lightboxClose');
var lightboxPrev = document.getElementById('lightboxPrev');
var lightboxNext = document.getElementById('lightboxNext');
var lightboxImages = [];
var lightboxIndex = 0;

document.querySelectorAll('[data-lightbox]').forEach(function (item, i) {
  var img = item.querySelector('img');
  if (img) lightboxImages.push(img.src);

  item.addEventListener('click', function () {
    lightboxIndex = i;
    openLightbox(lightboxImages[i]);
  });
});

function openLightbox(src) {
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src;
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightbox) {
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
}

if (lightboxPrev) {
  lightboxPrev.addEventListener('click', function () {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    if (lightboxImg) lightboxImg.src = lightboxImages[lightboxIndex];
  });
}

if (lightboxNext) {
  lightboxNext.addEventListener('click', function () {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    if (lightboxImg) lightboxImg.src = lightboxImages[lightboxIndex];
  });
}

document.addEventListener('keydown', function (e) {
  if (!lightbox || !lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && lightboxPrev) lightboxPrev.click();
  if (e.key === 'ArrowRight' && lightboxNext) lightboxNext.click();
});

// ========== COOKIE BANNER ==========
var cookieBanner = document.getElementById('cookieBanner');
var cookieAccept = document.getElementById('cookieAccept');
if (cookieBanner && !localStorage.getItem('cookies_accepted')) {
  cookieBanner.style.display = 'block';
}
if (cookieAccept) {
  cookieAccept.addEventListener('click', function () {
    localStorage.setItem('cookies_accepted', '1');
    if (cookieBanner) cookieBanner.style.display = 'none';
  });
}

})();
