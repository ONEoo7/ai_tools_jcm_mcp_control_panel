const PYPI_URL = "https://pypi.org/pypi/jcodemunch-mcp/json";

export interface LatestVersion {
  latest: string | null;
  error?: string;
}

/**
 * Fetch the latest published version from PyPI (the source `upgrade` pulls from).
 * Cached for up to an hour; fails soft so the dashboard still renders offline.
 */
export async function getLatestVersion(): Promise<LatestVersion> {
  try {
    const res = await fetch(PYPI_URL, {
      // Revalidate at most hourly; never block the page for long.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { latest: null, error: `PyPI responded ${res.status}` };
    const json = (await res.json()) as { info?: { version?: string } };
    return { latest: json.info?.version ?? null };
  } catch (err) {
    return {
      latest: null,
      error: err instanceof Error ? err.message : "Could not reach PyPI",
    };
  }
}

/** Compare two dotted version strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10));
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = Number.isFinite(pa[i]) ? pa[i] : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** True when a newer version is available online than the one installed. */
export function isUpgradeAvailable(
  local: string | null,
  latest: string | null,
): boolean {
  if (!local || !latest) return false;
  return compareVersions(latest, local) > 0;
}
