import { Request, Response } from "express";
import { z } from "zod";
import { GetDashboardStatsUseCase } from "@/application/admin/analytics/GetDashboardStats.usecase";
import { GetGrowthAnalyticsUseCase } from "@/application/admin/analytics/GetGrowthAnalytics.usecase";
import { GetTopPropertiesUseCase } from "@/application/admin/analytics/GetTopProperties.usecase";
import { GetSystemHealthUseCase } from "@/application/admin/system/GetSystemHealth.usecase";
import { growthAnalyticsQuerySchema, topPropertiesQuerySchema } from "@/interfaces/http/validators/admin.schemas";

/** Admin Dashboard (Part 1) + Analytics (Part 7) + System Health (Part 1). */
export class AdminDashboardController {
  constructor(
    private readonly getDashboardStats: GetDashboardStatsUseCase,
    private readonly getGrowthAnalytics: GetGrowthAnalyticsUseCase,
    private readonly getTopProperties: GetTopPropertiesUseCase,
    private readonly getSystemHealth: GetSystemHealthUseCase,
  ) {}

  stats = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.getDashboardStats.execute();
    res.status(200).json(result);
  };

  growth = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof growthAnalyticsQuerySchema>;
    const result = await this.getGrowthAnalytics.execute(query);
    res.status(200).json(result);
  };

  topProperties = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof topPropertiesQuerySchema>;
    const result = await this.getTopProperties.execute(query);
    res.status(200).json(result);
  };

  systemHealth = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.getSystemHealth.execute();
    res.status(result.status === "ok" ? 200 : 503).json(result);
  };
}
