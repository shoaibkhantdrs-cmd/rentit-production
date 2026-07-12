import { Request, Response } from "express";
import { z } from "zod";
import { SearchAuditLogsUseCase } from "@/application/admin/audit/SearchAuditLogs.usecase";
import { AuditLogRecord } from "@/domain/repositories/IAuditLogRepository";
import { searchAuditLogsQuerySchema } from "@/interfaces/http/validators/admin.schemas";

const CSV_EXPORT_PAGE_SIZE = 5000;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(items: AuditLogRecord[]): string {
  const header = ["id", "userId", "action", "entityType", "entityId", "ipAddress", "userAgent", "createdAt"];
  const rows = items.map((item) =>
    [
      item.id,
      item.userId ?? "",
      item.action,
      item.entityType ?? "",
      item.entityId ?? "",
      item.ipAddress ?? "",
      item.userAgent ?? "",
      item.createdAt.toISOString(),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Audit Logs (Phase 4 Part 8): search and CSV export. Export reuses the
 * exact same use-case with a larger page size -- CSV formatting is a
 * presentation concern that belongs here, not in the use-case. */
export class AdminAuditController {
  constructor(private readonly searchAuditLogs: SearchAuditLogsUseCase) {}

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof searchAuditLogsQuerySchema>;

    if (query.format === "csv") {
      const result = await this.searchAuditLogs.execute({
        userId: query.userId,
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: 1,
        pageSize: CSV_EXPORT_PAGE_SIZE,
      });
      res.status(200);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-logs.csv"`);
      res.send(toCsv(result.items));
      return;
    }

    const result = await this.searchAuditLogs.execute({
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };
}
