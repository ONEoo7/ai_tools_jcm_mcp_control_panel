import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs pulls in optional native/dynamic requires; keep it out of the bundle
  // so it runs from node_modules at runtime inside route handlers.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
