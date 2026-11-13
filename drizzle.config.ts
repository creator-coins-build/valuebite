import { defineConfig } from "drizzle-kit";
export default defineConfig({ dialect: "postgresql", schema: "./src/modules/db/schema.ts", out: "./drizzle" });
