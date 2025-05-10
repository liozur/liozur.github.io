import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import markdownReplace from "./plugins/markdown-replace";
import remarkSqueezeParagraphs from 'remark-squeeze-paragraphs'

export default defineConfig({
    site: "https://liozur.github.io/",
    base: "/",
    integrations: [sitemap()],
    markdown: {
        shikiConfig: {
            theme: "github-light-default",
            langs: [],
        },

        remarkPlugins: [
            markdownReplace,
            remarkSqueezeParagraphs,
        ],

        rehypePlugins: [
        ]
    },
});
