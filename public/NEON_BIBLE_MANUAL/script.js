// ========================================
// NEON_BIBLE Manual - Interactive Features
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll for navigation links
    initSmoothScroll();

    // Active navigation highlighting
    initActiveNavigation();

    // Add entrance animations
    initAnimations();
});

/**
 * Initialize smooth scrolling for anchor links
 */
function initSmoothScroll() {
    const navLinks = document.querySelectorAll('a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');

            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const targetPosition = targetElement.offsetTop - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Highlight active section in navigation
 */
function initActiveNavigation() {
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-link');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    if (!sectionId) return;

                    // Remove active class from all links
                    navLinks.forEach(link => {
                        link.style.color = '';
                        link.style.background = '';
                    });

                    // Add active class to current section link
                    const activeLink = document.querySelector(`a[href="#${sectionId}"]`);
                    if (activeLink && activeLink.classList.contains('nav-link')) {
                        activeLink.style.color = 'var(--primary)';
                        activeLink.style.background = 'var(--glass-bg)';
                    }
                }
            });
        },
        {
            rootMargin: '-20% 0px -70% 0px'
        }
    );

    sections.forEach(section => {
        observer.observe(section);
    });
}

/**
 * Initialize entrance animations for elements
 */
function initAnimations() {
    const animatedElements = document.querySelectorAll(
        '.glass-card, .tool-card, .property-card, .feature-card, .shortcut-category, .faq-item'
    );

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // Stagger animation
                    setTimeout(() => {
                        entry.target.style.opacity = '0';
                        entry.target.style.transform = 'translateY(20px)';

                        requestAnimationFrame(() => {
                            entry.target.style.transition = 'all 0.6s ease-out';
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        });
                    }, index * 50);

                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.1
        }
    );

    animatedElements.forEach(el => {
        observer.observe(el);
    });
}

/**
 * Add parallax effect to hero section (optional enhancement)
 */
function initParallax() {
    const hero = document.querySelector('.hero');

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallaxSpeed = 0.5;

        if (hero && scrolled < window.innerHeight) {
            hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
        }
    });
}

// Uncomment to enable parallax effect
// initParallax();

console.log('🎨 NEON_BIBLE Manual loaded successfully!');
