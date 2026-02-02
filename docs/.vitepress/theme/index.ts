import DefaultTheme from 'vitepress/theme'
import './custom.css'
import Footer from './Footer.vue'
import MermaidZoom from './MermaidZoom.vue'
import CookieConsent from './CookieConsent.vue'
import LandingExtras from './LandingExtras.vue'
import { h } from 'vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(LandingExtras),
      'layout-bottom': () => [h(Footer), h(CookieConsent)],
      'doc-after': () => h(MermaidZoom)
    })
  },
  setup() {
    if (globalThis.window !== undefined) {
      // Hide navbar when scrolled to bottom to show full footer
      globalThis.window.addEventListener('DOMContentLoaded', () => {
        const handleScroll = () => {
          const navbar = document.querySelector('.VPNav');
          if (!navbar) return;

          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const scrollHeight = document.documentElement.scrollHeight;
          const clientHeight = document.documentElement.clientHeight;
          
          // Check if scrolled within 100px of bottom
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
          
          if (isAtBottom) {
            navbar.classList.add('hide-at-bottom');
          } else {
            navbar.classList.remove('hide-at-bottom');
          }
        };

        document.addEventListener('scroll', handleScroll);
        handleScroll(); // Check initial state
      });

      // Add smooth mouse-following effect to hero logo
      globalThis.window.addEventListener('DOMContentLoaded', () => {
        const initLogoEffect = () => {
          const heroImage = document.querySelector('.VPHero .image-container, .VPHero .VPImage');
          if (!heroImage) return;

          let mouseX = 0, mouseY = 0;
          let currentX = 0, currentY = 0;
          let animationFrame: number;

          const updatePosition = () => {
            // Smooth interpolation - slower movement
            const ease = 0.08;
            currentX += (mouseX - currentX) * ease;
            currentY += (mouseY - currentY) * ease;

            // Apply transform with circular movement
            (heroImage as HTMLElement).style.transform = 
              `translate(${currentX}px, ${currentY}px) rotate(${currentX * 0.02}deg)`;

            animationFrame = requestAnimationFrame(updatePosition);
          };

          const handleMouseMove = (e: MouseEvent) => {
            const rect = heroImage.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance from center with larger range
            const maxDistance = 35; // Increased movement area
            mouseX = ((e.clientX - centerX) / window.innerWidth) * maxDistance;
            mouseY = ((e.clientY - centerY) / window.innerHeight) * maxDistance;
          };

          const handleMouseLeave = () => {
            mouseX = 0;
            mouseY = 0;
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseleave', handleMouseLeave);
          
          updatePosition();

          // Cleanup
          return () => {
            cancelAnimationFrame(animationFrame);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
          };
        };

        // Initialize after a short delay to ensure DOM is ready
        setTimeout(initLogoEffect, 100);
      });
    }
  }
}
