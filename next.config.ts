import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime rendering required for live Supabase data (dynamic ads,
  // view counters, moderation). Use `npm run dev` or `npx next start`.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
