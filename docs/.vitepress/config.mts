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
        { text: "Guide", link: "/getting_started" },
        { text: "Architecture", link: "/system_architecture" },
        { text: "API", link: "/api" },
        {
          text: "v0.3.0",
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
