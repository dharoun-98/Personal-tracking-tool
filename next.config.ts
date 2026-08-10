import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
  env: {
    /**
     * The version badge in the nav reads this.
     *
     * Sourced from package.json rather than an environment variable so it can
     * never drift — it previously showed a hardcoded fallback of 0.1.0 while
     * the app was actually on 0.3.1, because nobody had set the env var. An
     * explicit override still wins, for preview builds that want to say
     * something else.
     */
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? pkg.version,
  },
};

export default nextConfig;
