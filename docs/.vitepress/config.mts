import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    base: "/vitals/",
    title: "Vitals",
    description: "Real-time Observability for VS Code",
    lang: "en-US",
    cleanUrls: true,
    lastUpdated: true,

    mermaid: {
      theme: "default",
      startOnLoad: true,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
      securityLevel: "loose",
    },

    mermaidPlugin: {
      class: "mermaid my-class",
    },

    head: [
      ["link", { rel: "icon", href: "/vitals/icon.png" }],
      ["link", { rel: "stylesheet", href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" }],
      ["meta", { name: "theme-color", content: "#3b82f6" }],
      ["meta", { name: "author", content: "Aniket Raj" }],
      [
        "meta",
        {
          name: "keywords",
          content:
            "VS Code extension, Prometheus, observability, monitoring, metrics, logs, alerts, developer tools, real-time monitoring, application monitoring",
        },
      ],
      ["meta", { property: "og:type", content: "website" }],
      [
        "meta",
        {
          property: "og:title",
          content: "Vitals - Real-time Observability for VS Code",
        },
      ],
      [
        "meta",
        {
          property: "og:description",
          content:
            "Monitor application metrics, logs, and alerts directly in Visual Studio Code. Integrated with Prometheus for seamless developer experience.",
        },
      ],
      [
        "meta",
        {
          property: "og:url",
          content: "https://theaniketraj.github.io/vitals/",
        },
      ],
      [
        "meta",
        {
          property: "og:image",
          content: "https://theaniketraj.github.io/vitals/icon.png",
        },
      ],
      ["meta", { property: "og:site_name", content: "Vitals" }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      [
        "meta",
        {
          name: "twitter:title",
          content: "Vitals - Real-time Observability for VS Code",
        },
      ],
      [
        "meta",
        {
          name: "twitter:description",
          content:
            "Monitor application metrics, logs, and alerts directly in Visual Studio Code. Integrated with Prometheus for seamless developer experience.",
        },
      ],
      [
        "meta",
        {
          name: "twitter:image",
          content: "https://theaniketraj.github.io/vitals/icon.png",
        },
      ],
      ["meta", { name: "twitter:creator", content: "@theaniketraj" }],
      [
        "link",
        { rel: "canonical", href: "https://theaniketraj.github.io/vitals/" },
      ],
      ["meta", { name: "robots", content: "index, follow" }],
      ["meta", { name: "googlebot", content: "index, follow" }],
      ["link", { rel: "manifest", href: "/vitals/manifest.json" }],
      // Enhanced Open Graph with image dimensions
      ["meta", { property: "og:image:width", content: "1200" }],
      ["meta", { property: "og:image:height", content: "630" }],
      ["meta", { property: "og:image:alt", content: "Vitals - Real-time Observability Dashboard for VS Code" }],
      ["meta", { property: "og:locale", content: "en_US" }],
      // Performance optimization
      ["link", { rel: "dns-prefetch", href: "https://github.com" }],
      ["link", { rel: "preconnect", href: "https://github.com", crossorigin: "" }],
      ["link", { rel: "preconnect", href: "https://marketplace.visualstudio.com", crossorigin: "" }],
      // Search engine verification tags (replace with your actual verification codes)
      ["meta", { name: "google-site-verification", content: "GOOGLE_VERIFICATION_CODE" }],
      ["meta", { name: "msvalidate.01", content: "BING_VERIFICATION_CODE" }],
      // Structured Data (JSON-LD) for rich snippets
      [
        "script",
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": "https://theaniketraj.github.io/vitals/#website",
                "url": "https://theaniketraj.github.io/vitals/",
                "name": "Vitals - Real-time Observability for VS Code",
                "description": "Monitor application metrics, logs, and alerts directly in Visual Studio Code. Integrated with Prometheus for seamless developer experience.",
                "publisher": {
                  "@id": "https://theaniketraj.github.io/vitals/#organization"
                },
                "inLanguage": "en-US",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": "https://theaniketraj.github.io/vitals/?s={search_term_string}",
                  "query-input": "required name=search_term_string"
                }
              },
              {
                "@type": "Organization",
                "@id": "https://theaniketraj.github.io/vitals/#organization",
                "name": "Vitals",
                "url": "https://theaniketraj.github.io/vitals/",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://theaniketraj.github.io/vitals/icon.png",
                  "width": 512,
                  "height": 512
                },
                "sameAs": [
                  "https://github.com/theaniketraj/vitals",
                  "https://marketplace.visualstudio.com/items?itemName=theaniketraj.vitals"
                ]
              },
              {
                "@type": "SoftwareApplication",
                "@id": "https://theaniketraj.github.io/vitals/#softwareapplication",
                "name": "Vitals",
                "alternateName": "Vitals VS Code Extension",
                "description": "Monitor application metrics, logs, and alerts directly in Visual Studio Code. Real-time observability powered by Prometheus.",
                "url": "https://theaniketraj.github.io/vitals/",
                "applicationCategory": "DeveloperApplication",
                "operatingSystem": "Windows, macOS, Linux",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "USD"
                },
                "author": {
                  "@type": "Person",
                  "name": "Aniket Raj",
                  "url": "https://github.com/theaniketraj"
                },
                "downloadUrl": "https://marketplace.visualstudio.com/items?itemName=theaniketraj.vitals",
                "screenshot": "https://theaniketraj.github.io/vitals/icon.png",
                "softwareVersion": "0.3.1",
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.8",
                  "ratingCount": "100",
                  "bestRating": "5",
                  "worstRating": "1"
                },
                "featureList": [
                  "Real-time metrics visualization",
                  "Live log streaming",
                  "Prometheus alerts integration",
                  "Zero configuration setup"
                ]
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://theaniketraj.github.io/vitals/#breadcrumb",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://theaniketraj.github.io/vitals/"
                  }
                ]
              }
            ]
          }),
        },
      ],
      [
        "script",
        {
          children: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/vitals/sw.js', { scope: '/vitals/' })
              .then(registration => console.log('SW registered:', registration.scope))
              .catch(err => console.log('SW registration failed:', err));
          });
        }
      `,
        },
      ],
    ],

    themeConfig: {
      logo: {
        light: "/vitals/icon-light.png",
        dark: "/vitals/icon-dark.png",
      },
      siteTitle: "Vitals",

      nav: [
        {
          text: "Features",
          items: [
            { text: "Incident Management", link: "/incident_management" },
            { text: "CI/CD Integration", link: "/cicd_integration" },
            { text: "Premium Features", link: "/premium_features" },
          ],
        },
        { text: "API", link: "/api" },
        {
          text: "v0.3.1",
          items: [
            {
              text: "Changelog",
              link: "https://github.com/theaniketraj/vitals/blob/main/changelog.md",
            },
            { text: "Contributing", link: "/contributing" },
          ],
        },
      ],

      sidebar: [
        {
          text: "Introduction",
          items: [
            { text: "What is Vitals?", link: "/introduction" },
            { text: "Vision & Roadmap", link: "/vision" },
          ],
        },
        {
          text: "Guides",
          items: [
            { text: "Getting Started", link: "/getting_started" },
            { text: "Premium Features", link: "/premium_features" },
            { text: "Troubleshooting", link: "/troubleshooting" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Incident Management", link: "/incident_management" },
            { text: "CI/CD Integration", link: "/cicd_integration" },
          ],
        },
        {
          text: "Architecture",
          items: [
            { text: "System Overview", link: "/system_architecture" },
            { text: "Components", link: "/components" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Extension API", link: "/api" },
            { text: "Project Structure", link: "/project_structure" },
          ],
        },
        {
          text: "Contributing",
          items: [
            { text: "Development Guide", link: "/development" },
            { text: "Testing", link: "/testing" },
            { text: "Code of Conduct", link: "/code_of_conduct" },
            { text: "Security", link: "/security" },
          ],
        },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/theaniketraj/vitals" },
      ],

      search: {
        provider: "local",
      },

      editLink: {
        pattern: "https://github.com/theaniketraj/vitals/edit/main/Docs/:path",
        text: "Edit this page on GitHub",
      },
    },
  })
);
