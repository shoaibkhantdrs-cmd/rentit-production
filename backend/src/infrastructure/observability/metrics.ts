import type { NextFunction, Request, Response } from "express";

/**
 * A minimal, hand-rolled Prometheus exposition-format metrics registry --
 * no `prom-client` dependency, following this codebase's established
 * pattern of hand-rolling infrastructure that doesn't need a full library
 * (WebSocket framing, JWT, compression). Covers exactly what a real
 * dashboard/alerting setup needs to start with: request counts and
 * latency by route+status (the RED method: Rate, Errors, Duration), plus
 * process-level basics.
 *
 * Deliberately in-memory and per-process -- correct for a single instance
 * or for Prometheus scraping each instance individually (the normal
 * setup), same scaling note as express-rate-limit's in-memory store.
 */

interface RouteMetric {
  count: number;
  totalDurationMs: number;
  /** Cumulative counts per upper bucket bound, Prometheus histogram style. */
  buckets: Map<number, number>;
}

const HISTOGRAM_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const routeMetrics = new Map<string, RouteMetric>();
const statusCounts = new Map<string, number>();
let totalRequests = 0;

function metricKey(method: string, route: string): string {
  return `${method} ${route}`;
}

function recordRequest(method: string, route: string, statusCode: number, durationMs: number): void {
  totalRequests += 1;

  const key = metricKey(method, route);
  let metric = routeMetrics.get(key);
  if (!metric) {
    metric = { count: 0, totalDurationMs: 0, buckets: new Map(HISTOGRAM_BUCKETS_MS.map((b) => [b, 0])) };
    routeMetrics.set(key, metric);
  }
  metric.count += 1;
  metric.totalDurationMs += durationMs;
  for (const bucket of HISTOGRAM_BUCKETS_MS) {
    if (durationMs <= bucket) {
      metric.buckets.set(bucket, (metric.buckets.get(bucket) ?? 0) + 1);
    }
  }

  const statusKey = `${method}:${route}:${Math.floor(statusCode / 100)}xx`;
  statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);
}

/** Mounted globally in app.ts, before routes so it wraps every request. */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      // req.route is only populated once Express matches a route; for
      // 404s (no route matched) group under the literal path to avoid an
      // unbounded label cardinality explosion from arbitrary garbage URLs.
      const route = req.route?.path
        ? `${req.baseUrl}${req.route.path}`
        : res.statusCode === 404
          ? "unmatched"
          : req.path;
      recordRequest(req.method, route, res.statusCode, durationMs);
    });

    next();
  };
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Renders the current metrics in Prometheus text exposition format. */
export function renderMetrics(): string {
  const lines: string[] = [];

  lines.push("# HELP rentit_http_requests_total Total HTTP requests handled.");
  lines.push("# TYPE rentit_http_requests_total counter");
  for (const [key, metric] of routeMetrics) {
    const [method, ...routeParts] = key.split(" ");
    const route = routeParts.join(" ");
    lines.push(
      `rentit_http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}"} ${metric.count}`,
    );
  }

  lines.push("# HELP rentit_http_request_duration_ms_sum Sum of request durations in milliseconds.");
  lines.push("# TYPE rentit_http_request_duration_ms_sum counter");
  for (const [key, metric] of routeMetrics) {
    const [method, ...routeParts] = key.split(" ");
    const route = routeParts.join(" ");
    lines.push(
      `rentit_http_request_duration_ms_sum{method="${escapeLabel(method)}",route="${escapeLabel(route)}"} ${metric.totalDurationMs.toFixed(3)}`,
    );
  }

  lines.push("# HELP rentit_http_request_duration_ms_bucket Request duration histogram (milliseconds).");
  lines.push("# TYPE rentit_http_request_duration_ms_bucket histogram");
  for (const [key, metric] of routeMetrics) {
    const [method, ...routeParts] = key.split(" ");
    const route = routeParts.join(" ");
    for (const bucket of HISTOGRAM_BUCKETS_MS) {
      lines.push(
        `rentit_http_request_duration_ms_bucket{method="${escapeLabel(method)}",route="${escapeLabel(route)}",le="${bucket}"} ${metric.buckets.get(bucket) ?? 0}`,
      );
    }
    lines.push(
      `rentit_http_request_duration_ms_bucket{method="${escapeLabel(method)}",route="${escapeLabel(route)}",le="+Inf"} ${metric.count}`,
    );
  }

  lines.push("# HELP rentit_http_responses_by_status_total Responses grouped by status class.");
  lines.push("# TYPE rentit_http_responses_by_status_total counter");
  for (const [key, count] of statusCounts) {
    const [method, route, statusClass] = key.split(":");
    lines.push(
      `rentit_http_responses_by_status_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status_class="${statusClass}"} ${count}`,
    );
  }

  lines.push("# HELP rentit_http_requests_in_flight_total Total requests received since process start.");
  lines.push("# TYPE rentit_http_requests_in_flight_total counter");
  lines.push(`rentit_http_requests_in_flight_total ${totalRequests}`);

  lines.push("# HELP rentit_process_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE rentit_process_uptime_seconds gauge");
  lines.push(`rentit_process_uptime_seconds ${process.uptime().toFixed(3)}`);

  const mem = process.memoryUsage();
  lines.push("# HELP rentit_process_memory_bytes Process memory usage by type.");
  lines.push("# TYPE rentit_process_memory_bytes gauge");
  lines.push(`rentit_process_memory_bytes{type="rss"} ${mem.rss}`);
  lines.push(`rentit_process_memory_bytes{type="heapTotal"} ${mem.heapTotal}`);
  lines.push(`rentit_process_memory_bytes{type="heapUsed"} ${mem.heapUsed}`);
  lines.push(`rentit_process_memory_bytes{type="external"} ${mem.external}`);

  return lines.join("\n") + "\n";
}
