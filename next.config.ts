import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pg",
    "mysql2",
    "better-sqlite3",
    "@pinecone-database/pinecone",
    "chromadb",
    "@qdrant/js-client-rest",
  ],
};

export default nextConfig;
