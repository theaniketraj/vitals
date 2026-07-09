/**
 * Analytics utility for Vitals documentation
 * Handles cookie consent and event tracking
 */

export interface AnalyticsEvent {
  event: string;
  timestamp: string;
  page: string;
  properties?: Record<string, any>;
}

export class VitalsAnalytics {
  private static instance: VitalsAnalytics;
  private hasConsent: boolean = false;
  private readonly sessionId: string;
  private readonly sessionStart: number;
  private pageViewStart: number;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    this.pageViewStart = Date.now();

    // Only run in browser environment
    if (globalThis.window !== undefined) {
      this.checkConsent();
      this.setupListeners();
    }
  }

  static getInstance(): VitalsAnalytics {
    if (!VitalsAnalytics.instance) {
      VitalsAnalytics.instance = new VitalsAnalytics();
    }
    return VitalsAnalytics.instance;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkConsent(): void {
    if (typeof localStorage === "undefined") return;

    const consent = localStorage.getItem("vitals-cookie-consent");
    this.hasConsent = consent === "true";
  }

  private setupListeners(): void {
    if (typeof document === "undefined" || globalThis.window === undefined)
      return;

    // Listen for visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.trackTimeOnPage();
      } else {
        this.pageViewStart = Date.now();
      }
    });

    // Track before unload
    window.addEventListener("beforeunload", () => {
      this.trackTimeOnPage();
      this.trackSessionEnd();
    });

    // Track scroll depth
    this.trackScrollDepth();

    // Track clicks on documentation navigation
    this.trackNavigation();
  }

  private trackTimeOnPage(): void {
    if (!this.hasConsent) return;

    const timeOnPage = Math.round((Date.now() - this.pageViewStart) / 1000);

    if (timeOnPage > 3) {
      // Only track if more than 3 seconds
      this.track("time_on_page", {
        duration: timeOnPage,
        path: globalThis.location.pathname,
      });
    }
  }

  private trackSessionEnd(): void {
    if (!this.hasConsent) return;

    const sessionDuration = Math.round((Date.now() - this.sessionStart) / 1000);

    this.track("session_end", {
      sessionId: this.sessionId,
      duration: sessionDuration,
    });
  }

  private trackScrollDepth(): void {
    let maxScrollDepth = 0;
    let scrollTimeout: number;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);

      scrollTimeout = window.setTimeout(() => {
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);

        if (scrollPercent > maxScrollDepth) {
          maxScrollDepth = scrollPercent;

          // Track milestone depths
          if ([25, 50, 75, 100].includes(maxScrollDepth)) {
            this.track("scroll_depth", {
              depth: maxScrollDepth,
              path: globalThis.location.pathname,
            });
          }
        }
      }, 100);
    };

    window.addEventListener("scroll", handleScroll);
  }

  private trackNavigation(): void {
    // Track sidebar navigation clicks
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (!link?.href) return;

      const url = new URL(link.href);

      // Internal navigation
      if (url.origin === globalThis.location.origin) {
        this.track("internal_navigation", {
          from: globalThis.location.pathname,
          to: url.pathname,
          text: link.textContent?.trim() || "",
        });
      } else {
        // External link
        this.track("external_link", {
          url: link.href,
          text: link.textContent?.trim() || "",
        });
      }
    });
  }

  /**
   * Track an analytics event
   */
  track(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.hasConsent) {
      console.log("Analytics disabled - no consent");
      return;
    }

    const event: AnalyticsEvent = {
      event: eventName,
      timestamp: new Date().toISOString(),
      page: globalThis.location.pathname,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
      },
    };

    // Send to service worker
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "TRACK_EVENT",
        eventName: event.event,
        properties: event.properties,
        hasConsent: true,
      });
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log("📊 Analytics:", event);
    }

    // In production, you would send to your backend
    // this.sendToBackend(event)
  }

  /**
   * Track page view
   */
  trackPageView(): void {
    this.pageViewStart = Date.now();

    this.track("page_view", {
      title: document.title,
      path: globalThis.location.pathname,
      hash: globalThis.location.hash,
      search: globalThis.location.search,
    });
  }

  /**
   * Track search queries (if using VitePress search)
   */
  trackSearch(query: string, resultsCount: number): void {
    this.track("search", {
      query,
      resultsCount,
    });
  }

  /**
   * Track code copy events
   */
  trackCodeCopy(language: string): void {
    this.track("code_copy", {
      language,
      path: globalThis.location.pathname,
    });
  }

  /**
   * Track theme changes
   */
  trackThemeChange(theme: "light" | "dark"): void {
    this.track("theme_change", {
      theme,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update consent status
   */
  updateConsent(hasConsent: boolean): void {
    this.hasConsent = hasConsent;
    localStorage.setItem(
      "vitals-cookie-consent",
      hasConsent ? "true" : "false",
    );
    localStorage.setItem(
      "vitals-cookie-consent-timestamp",
      Date.now().toString(),
    );

    if (hasConsent) {
      this.track("consent_granted", {
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send event to backend (implement your own endpoint)
   */
  private async sendToBackend(event: AnalyticsEvent): Promise<void> {
    try {
      // Example: Send to your analytics backend
      // await fetch('https://your-backend.com/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // })

      console.log("Analytics event sent:", event);
    } catch (error) {
      console.error("Failed to send analytics:", error);
    }
  }
}

// Export singleton instance
export const analytics =
  globalThis.window === undefined
    ? (null as any)
    : VitalsAnalytics.getInstance();

// Make available globally for easy access
if (globalThis.window !== undefined) {
  (globalThis as any).vitalsAnalytics = analytics;
}
