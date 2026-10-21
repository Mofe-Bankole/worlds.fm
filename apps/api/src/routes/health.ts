import type { FastifyInstance } from "fastify";
import type { ApiHealth } from "@worlds/shared";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (): Promise<ApiHealth> => {
    return { status: "ok", service: "worlds-api" };
  });
}
