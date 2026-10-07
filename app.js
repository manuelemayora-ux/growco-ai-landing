'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────
  // 1. SCROLL ANIMATIONS (IntersectionObserver)
  // ─────────────────────────────────────────────
  function initScrollAnimations() {
    const fadeEls = document.querySelectorAll('.fade-up');
    if (!fadeEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target); // animate once only
          }
        });
      },
      { threshold: 0.1, rootMargin: '-50px' }
    );

    fadeEls.forEach((el) => observer.observe(el));
  }

  // ─────────────────────────────────────────────
  // 2. NAVBAR SCROLL EFFECT
  // ─────────────────────────────────────────────
  function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
          } else {
            navbar.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Run once on init in case page loads mid-scroll
    onScroll();
  }

  // ─────────────────────────────────────────────
  // 3. SMOOTH SCROLL
  // ─────────────────────────────────────────────
  function initSmoothScroll() {
    const anchors = document.querySelectorAll("a[href^='#']");
    if (!anchors.length) return;

    anchors.forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 80;

        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth',
        });
      });
    });
  }

  // ─────────────────────────────────────────────
  // 4. VIDEO MARQUEE INTERACTION
  // ─────────────────────────────────────────────
  function initVideoMarquee() {
    const wrapper = document.querySelector('.video-marquee-wrapper');
    const track = document.querySelector('.video-marquee');
    if (!wrapper || !track) return;

    const videoCards = document.querySelectorAll('.video-card');
    const modal = document.getElementById('video-modal');

    // Disable CSS marquee animation to control it via JS for dragging
    track.style.animation = 'none';

    let scrollX = 0;
    const speed = 1.0; // speed of auto-scroll in pixels per frame
    let isDragging = false;
    let isHovered = false;
    let startX = 0;
    let dragScrollX = 0;
    let dragDistance = 0;

    // Helper to calculate half width
    function getHalfWidth() {
      return track.scrollWidth / 2;
    }

    // Animation Loop
    function animate() {
      if (!isDragging && !isHovered) {
        scrollX += speed;
        const halfWidth = getHalfWidth();
        if (halfWidth > 0) {
          if (scrollX >= halfWidth) {
            scrollX = scrollX % halfWidth;
          }
        }
        track.style.transform = `translate3d(${-scrollX}px, 0, 0)`;
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    // Hover Events for auto-scroll pause
    wrapper.addEventListener('mouseenter', () => {
      isHovered = true;
    });

    wrapper.addEventListener('mouseleave', () => {
      isHovered = false;
      if (isDragging) {
        isDragging = false;
        wrapper.classList.remove('dragging');
        setTimeout(() => {
          wrapper.setAttribute('data-dragged', 'false');
        }, 50);
      }
    });

    // Drag events
    const startDrag = (e) => {
      isDragging = true;
      dragDistance = 0;
      wrapper.setAttribute('data-dragged', 'false');
      startX = e.pageX || e.touches[0].pageX;
      dragScrollX = scrollX;
    };

    const moveDrag = (e) => {
      if (!isDragging) return;
      
      const x = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0);
      const walk = x - startX;
      dragDistance = Math.abs(walk);

      if (dragDistance > 5) {
        wrapper.setAttribute('data-dragged', 'true');
        wrapper.classList.add('dragging');
      }

      scrollX = dragScrollX - walk;

      const halfWidth = getHalfWidth();
      if (halfWidth > 0) {
        if (scrollX < 0) {
          scrollX = halfWidth + (scrollX % halfWidth);
        } else if (scrollX >= halfWidth) {
          scrollX = scrollX % halfWidth;
        }
      }

      track.style.transform = `translate3d(${-scrollX}px, 0, 0)`;
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.classList.remove('dragging');
      // Briefly hold data-dragged so click event registers it before resetting
      setTimeout(() => {
        wrapper.setAttribute('data-dragged', 'false');
      }, 50);
    };

    wrapper.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);

    wrapper.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDragging) {
        // Prevent default touch scrolling only if dragging horizontally
        moveDrag(e);
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    window.addEventListener('touchend', endDrag);

    // Mobile Intersection Observer for autoplay
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    let mobileObserver = null;
    if (isMobile) {
      mobileObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.muted = true; // Must be muted for autoplay on mobile
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.5 });
    }

    // Video hover / click behaviors
    videoCards.forEach((card) => {
      const cardVideo = card.querySelector('video');

      if (isMobile && cardVideo && mobileObserver) {
        mobileObserver.observe(cardVideo);
      }

      card.addEventListener('mouseenter', () => {
        if (cardVideo && !isMobile) {
          cardVideo.muted = false;
          cardVideo.play().catch((err) => {
            console.warn("Autoplay with audio blocked, playing muted as fallback:", err);
            cardVideo.muted = true;
            cardVideo.play().catch(() => {});
          });
        }
      });

      card.addEventListener('mouseleave', () => {
        if (cardVideo && !isMobile) {
          cardVideo.pause();
          cardVideo.currentTime = 0;
          cardVideo.muted = true;
        }
      });

      card.addEventListener('click', (e) => {
        // Ignore click if it was a drag interaction
        if (wrapper.getAttribute('data-dragged') === 'true') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (!modal || !cardVideo) return;
        const modalVideo = modal.querySelector('video');
        if (!modalVideo) return;

        // Copy source (prefer data-full-src for high-definition original video)
        const fullSrc = cardVideo.getAttribute('data-full-src') || cardVideo.getAttribute('src') || '';
        modalVideo.setAttribute('src', fullSrc);

        modalVideo.load();
        modal.classList.add('modal-active');
        modalVideo.play().catch(() => {});
      });
    });

    // Resize handling
    window.addEventListener('resize', () => {
      const halfWidth = getHalfWidth();
      if (scrollX >= halfWidth) {
        scrollX = scrollX % halfWidth;
      }
    });
  }

  // ─────────────────────────────────────────────
  // 5. VIDEO MODAL
  // ─────────────────────────────────────────────
  function initVideoModal() {
    const modal = document.getElementById('video-modal');
    if (!modal) return;

    const modalVideo = modal.querySelector('video');
    const closeBtn = modal.querySelector('.modal-close');

    function closeModal() {
      modal.classList.remove('modal-active');
      if (modalVideo) {
        modalVideo.pause();
        modalVideo.currentTime = 0;
      }
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
    }

    // Close when clicking the modal backdrop (not the video itself)
    modal.addEventListener('click', (e) => {
      if (e.target === modal || !e.target.closest('video, .modal-content, .modal-close')) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('modal-active')) {
        closeModal();
      }
    });
  }

  // Configurator state machine was removed as the section was deleted.

  // ─────────────────────────────────────────────
  // 7. CONTACT FORM
  // ─────────────────────────────────────────────
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const requiredFields = form.querySelectorAll('[required]');
      let allValid = true;

      // Clear previous error states
      requiredFields.forEach((field) => {
        field.style.borderColor = '';
      });

      // Validate
      requiredFields.forEach((field) => {
        if (!field.value.trim()) {
          allValid = false;
          field.style.borderColor = '#ef4444';
          field.style.transition = 'border-color 0.3s ease';

          // Remove red border after 2s
          setTimeout(() => {
            field.style.borderColor = '';
          }, 2000);
        }
      });

      if (!allValid) return;

      // Valid — send submission via FormSubmit
      const submitBtn = form.querySelector('[type="submit"], button:last-of-type');
      const originalText = submitBtn ? submitBtn.textContent : '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        submitBtn.style.opacity = '0.7';
      }

      const formData = {
        nombre: form.querySelector('#contact-nombre').value,
        email: form.querySelector('#contact-email').value,
        empresa: form.querySelector('#contact-empresa').value,
        mensaje: form.querySelector('#contact-mensaje').value
      };

      fetch('https://formsubmit.co/ajax/agente@growcoai.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      .then(response => response.json())
      .then(data => {
        if (submitBtn) {
          submitBtn.textContent = '¡Mensaje enviado!';
          submitBtn.style.color = '#22c55e';
          submitBtn.style.opacity = '1';
        }
        form.reset();
      })
      .catch(error => {
        console.error('Error submitting form:', error);
        if (submitBtn) {
          submitBtn.textContent = 'Error al enviar';
          submitBtn.style.color = '#ef4444';
          submitBtn.style.opacity = '1';
        }
      })
      .finally(() => {
        // Reset button after 4s
        setTimeout(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.color = '';
            submitBtn.style.opacity = '';
          }
        }, 4000);
      });
    });
  }

  // ─────────────────────────────────────────────
  // 8. NAV PILL INTERACTION
  // ─────────────────────────────────────────────
  function initNavPills() {
    const pills = document.querySelectorAll('.nav-pill');
    if (!pills.length) return;

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        
        // Auto-close mobile menu if open
        const navPills = document.querySelector('.nav-pills');
        const hamburger = document.querySelector('.nav-hamburger');
        if (navPills && navPills.classList.contains('mobile-open')) {
          navPills.classList.remove('mobile-open');
          if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // ─────────────────────────────────────────────
  // 8.5. MOBILE MENU TOGGLE
  // ─────────────────────────────────────────────
  function initMobileNav() {
    const hamburger = document.querySelector('.nav-hamburger');
    const navPills = document.querySelector('.nav-pills');
    if (!hamburger || !navPills) return;

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navPills.classList.toggle('mobile-open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close mobile nav when clicking outside
    document.addEventListener('click', (e) => {
      if (navPills.classList.contains('mobile-open') && !e.target.closest('#navbar')) {
        navPills.classList.remove('mobile-open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ─────────────────────────────────────────────
  // 9. COUNTER ANIMATION
  // ─────────────────────────────────────────────
  function initCounterAnimation() {
    const metrics = document.querySelectorAll('.metric-value');
    if (!metrics.length) return;

    function animateCounter(el) {
      const raw = el.textContent.trim();

      // Extract numeric part and any prefix/suffix symbols
      const prefix = raw.match(/^[<>~≈]*/)?.[0] || '';
      const suffix = raw.match(/[%+\-xX]*$/)?.[0] || '';
      const numericStr = raw.replace(/^[<>~≈]*/, '').replace(/[%+\-xX]*$/, '').replace(/,/g, '');
      const target = parseFloat(numericStr);

      if (isNaN(target)) return;

      const isDecimal = numericStr.includes('.');
      const decimalPlaces = isDecimal ? (numericStr.split('.')[1] || '').length : 0;
      const duration = 2000; // 2 seconds
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = eased * target;

        if (isDecimal) {
          el.textContent = prefix + current.toFixed(decimalPlaces) + suffix;
        } else {
          el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          // Ensure final value is exact
          el.textContent = raw;
        }
      }

      requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target); // animate once only
          }
        });
      },
      { threshold: 0.1 }
    );

    metrics.forEach((el) => observer.observe(el));
  }

  // ─────────────────────────────────────────────
  // 10. INITIALIZATION
  // ─────────────────────────────────────────────
  initScrollAnimations();
  initNavbarScroll();
  initSmoothScroll();
  initVideoMarquee();
  initVideoModal();
  initContactForm();
  initNavPills();
  initMobileNav();
  initCounterAnimation();

  console.log('Growco AI Filmmaker — Landing Page Initialized');
});
