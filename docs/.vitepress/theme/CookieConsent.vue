<template>
  <transition name="slide-up">
    <div
      v-if="showBanner"
      class="cookie-consent-banner"
      :class="{ 'dark-theme': isDark }"
    >
      <div class="cookie-consent-content">
        <div class="cookie-info">
          <h3>🍪 Cookie Consent</h3>
          <p>
            We use cookies to improve your experience and collect anonymous
            usage statistics. You can change your preference anytime.
            <a href="/vitals/USAGE_STATISTICS.html" class="learn-more"
              >Learn more</a
            >
          </p>
        </div>

        <div class="cookie-actions">
          <button @click="acceptCookies" class="btn btn-accept">Accept</button>
          <button @click="declineCookies" class="btn btn-decline">
            Decline
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useData } from "vitepress";
import { analytics } from "./analytics";

const CONSENT_KEY = "vitals-cookie-consent";
const CONSENT_TIMESTAMP_KEY = "vitals-cookie-consent-timestamp";
const CONSENT_DURATION = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
const DECLINE_REPROMPT_DURATION = 7 * 24 * 60 * 60 * 1000; // Re-prompt after 7 days if declined

const { isDark } = useData();
const showBanner = ref(false);

// Check if consent is still valid
function isConsentValid(): boolean {
  const consentTimestamp = localStorage.getItem(CONSENT_TIMESTAMP_KEY);
  if (!consentTimestamp) return false;

  const consent = localStorage.getItem(CONSENT_KEY);
  const elapsed = Date.now() - Number.parseInt(consentTimestamp);

  // If user accepted, consent lasts 1 year
  if (consent === "true") {
    return elapsed < CONSENT_DURATION;
  }

  // If user declined, re-prompt after 7 days
  if (consent === "false") {
    return elapsed < DECLINE_REPROMPT_DURATION;
  }

  return false;
}

// Check if consent was already given
function checkConsent(): boolean {
  const consent = localStorage.getItem(CONSENT_KEY);

  // No consent recorded - show banner
  if (consent === null) return false;

  // Check if consent is still valid based on accept/decline
  return isConsentValid();
}

// Accept cookies
function acceptCookies() {
  localStorage.setItem(CONSENT_KEY, "true");
  localStorage.setItem(CONSENT_TIMESTAMP_KEY, Date.now().toString());
  showBanner.value = false;

  // Update analytics consent
  analytics.updateConsent(true);

  // Register service worker with consent
  registerServiceWorker(true);

  // Track consent acceptance
  analytics.track("cookie_consent_accepted", {
    timestamp: new Date().toISOString(),
  });
}

// Decline cookies
function declineCookies() {
  localStorage.setItem(CONSENT_KEY, "false");
  localStorage.setItem(CONSENT_TIMESTAMP_KEY, Date.now().toString());
  showBanner.value = false;

  // Update analytics consent
  analytics.updateConsent(false);

  // Don't register service worker or track
  console.log("Cookie consent declined - analytics disabled");
}

// Register service worker
async function registerServiceWorker(hasConsent: boolean) {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        "/vitals/sw.js",
        {
          scope: "/vitals/",
        },
      );

      console.log("Service Worker registered:", registration.scope);

      // Send consent status to service worker
      if (registration.active) {
        registration.active.postMessage({
          type: "UPDATE_CONSENT",
          consent: hasConsent,
        });
      }
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  }
}

onMounted(() => {
  // Check if consent banner should be shown
  if (checkConsent()) {
    // Consent already given, register service worker
    const hasConsent = localStorage.getItem(CONSENT_KEY) === "true";
    if (hasConsent) {
      analytics.updateConsent(true);
      registerServiceWorker(true);
      analytics.trackPageView();
    }
  } else {
    // Show banner after a short delay for better UX
    setTimeout(() => {
      showBanner.value = true;
    }, 1000);
  }

  // Track outbound links
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");

    if (link?.href && !link.href.startsWith(globalThis.location.origin)) {
      analytics.track("outbound_link_click", {
        url: link.href,
        text: link.textContent || "",
      });
    }
  });
});

// Watch for theme changes and track
watch(isDark, (newTheme) => {
  analytics.trackThemeChange(newTheme ? "dark" : "light");
});
</script>

<style scoped>
.cookie-consent-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  backdrop-filter: blur(10px);
  border-top: 2px solid rgba(255, 255, 255, 0.1);
}

.cookie-consent-banner.dark-theme {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-top: 2px solid rgba(255, 255, 255, 0.05);
}

.cookie-consent-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.cookie-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cookie-info p {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.95;
  line-height: 1.5;
}

.learn-more {
  color: white;
  text-decoration: underline;
  font-weight: 500;
  transition: opacity 0.2s;
}

.learn-more:hover {
  opacity: 0.8;
}

.cookie-actions {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.btn-accept {
  background: white;
  color: #667eea;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-accept:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.dark-theme .btn-accept {
  background: #3b82f6;
  color: white;
}

.btn-decline {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.btn-decline:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.dark-theme .btn-decline {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .cookie-consent-banner {
    padding: 1rem;
  }

  .cookie-consent-content {
    flex-direction: column;
    gap: 1rem;
  }

  .cookie-info h3 {
    font-size: 1.1rem;
  }

  .cookie-info p {
    font-size: 0.9rem;
  }

  .cookie-actions {
    width: 100%;
  }

  .btn {
    flex: 1;
    padding: 0.65rem 1rem;
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .cookie-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
