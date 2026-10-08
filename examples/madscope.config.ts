import { defineConfig } from "@madscope/config";

export default defineConfig({
  urls: ["https://example.com"],
  viewports: [
    {
      id: "mobile",
      name: "Mobile",
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    },
    {
      id: "tablet",
      name: "Tablet",
      width: 768,
      height: 1024,
      isMobile: true,
      hasTouch: true,
    },
    { id: "desktop", name: "Desktop", width: 1440, height: 900 },
  ],
  diffThreshold: 0.005,
});
