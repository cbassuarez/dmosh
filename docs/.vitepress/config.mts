import { defineConfig } from "vitepress";

export default defineConfig({
  title: "dmosh docs",
  description: "User guide for the dmosh datamosh lab.",
  base: "/dmosh/docs/",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Concepts", link: "/concepts" },
      { text: "Tutorials", link: "/tutorials" },
      { text: "Troubleshooting", link: "/troubleshooting" },
    ],
    sidebar: {
      "/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/getting-started" },
            { text: "Concepts", link: "/concepts" },
            { text: "Tutorials", link: "/tutorials" },
            { text: "Troubleshooting", link: "/troubleshooting" },
          ],
        },
      ],
    },
  },
});
