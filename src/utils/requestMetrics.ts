type Bucket = {
  count: number;
  totalMs: number;
};

type Snapshot = {
  totals: {
    requests: number;
    errors: number;
    slow: number;
  };
  statuses: Record<string, number>;
  byRoute: Record<string, { count: number; avgMs: number }>;
  generatedAt: string;
};

const totals = {
  requests: 0,
  errors: 0,
  slow: 0,
};

const statuses = new Map<number, number>();
const byRoute = new Map<string, Bucket>();

export function trackRequestMetrics(input: {
  route: string;
  statusCode: number;
  durationMs: number;
  isSlow: boolean;
}) {
  totals.requests += 1;

  if (input.statusCode >= 500) {
    totals.errors += 1;
  }

  if (input.isSlow) {
    totals.slow += 1;
  }

  statuses.set(input.statusCode, (statuses.get(input.statusCode) || 0) + 1);

  const currentRoute = byRoute.get(input.route) || { count: 0, totalMs: 0 };
  currentRoute.count += 1;
  currentRoute.totalMs += input.durationMs;
  byRoute.set(input.route, currentRoute);
}

export function getRequestMetricsSnapshot(): Snapshot {
  const statusObject: Record<string, number> = {};
  for (const [statusCode, count] of statuses.entries()) {
    statusObject[String(statusCode)] = count;
  }

  const routeObject: Record<string, { count: number; avgMs: number }> = {};
  for (const [route, bucket] of byRoute.entries()) {
    routeObject[route] = {
      count: bucket.count,
      avgMs: Number((bucket.totalMs / bucket.count).toFixed(2)),
    };
  }

  return {
    totals: {
      requests: totals.requests,
      errors: totals.errors,
      slow: totals.slow,
    },
    statuses: statusObject,
    byRoute: routeObject,
    generatedAt: new Date().toISOString(),
  };
}
