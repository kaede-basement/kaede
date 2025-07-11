import { defineConfig } from "unocss";

export default defineConfig({
  theme: {
    animation: {
      keyframes: {
        gradient: "{from {background-position: 0 center} to {background-position: 200% center}}",
      },
      durations: {
        gradient: "3s",
      },
      timingFns: {
        gradient: "linear",
      },
      counts: {
        gradient: "infinite",
      },
    },
  },
});
