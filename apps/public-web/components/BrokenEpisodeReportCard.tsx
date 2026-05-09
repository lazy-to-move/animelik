"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BrokenEpisodeReportStatus = {
  canReport: boolean;
  lastReportedAt: string | Date | null;
  nextReportAt: string | Date | null;
  totalReports: number;
  reportsLast24h: number;
};

type BrokenEpisodeReportCardProps = {
  episodeId: number;
  episodeNumber: number;
  isSignedIn: boolean;
};

function formatDateTime(value: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function BrokenEpisodeReportCard({
  episodeId,
  episodeNumber,
  isSignedIn,
}: BrokenEpisodeReportCardProps) {
  const [status, setStatus] = useState<BrokenEpisodeReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(isSignedIn);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!isSignedIn) {
        setStatus(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/episodes/${episodeId}/broken-report-status`,
          {
            credentials: "same-origin",
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || "Unable to load report status.");
        }

        const payload = (await response.json()) as BrokenEpisodeReportStatus;
        if (!cancelled) {
          setStatus(payload);
        }
      } catch (statusError) {
        if (!cancelled) {
          setError(
            statusError instanceof Error
              ? statusError.message
              : "Unable to load report status.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [episodeId, isSignedIn]);

  async function reportBroken() {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/episodes/${episodeId}/report-broken`, {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to report this episode.");
      }

      const payload = (await response.json()) as {
        message: string;
        totalReports: number;
        reportsLast24h: number;
      };

      setStatus(() => ({
        canReport: false,
        lastReportedAt: new Date().toISOString(),
        nextReportAt: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        totalReports: payload.totalReports,
        reportsLast24h: payload.reportsLast24h,
      }));
      setMessage(payload.message);
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Unable to report this episode.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="panel watch-copy-panel report-panel">
        <div className="eyebrow">Player Report</div>
        <h2 style={{ marginTop: 0 }}>Broken stream reporting</h2>
        <p className="muted auth-copy">
          If episode {episodeNumber} is broken, sign in to send one report every
          24 hours and help track unstable hosts.
        </p>
        <div className="hero-actions">
          <Link href="/login" className="button primary">
            Sign In
          </Link>
          <Link href="/signup" className="button">
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel watch-copy-panel report-panel">
      <div className="eyebrow">Player Report</div>
      <h2 style={{ marginTop: 0 }}>Broken stream reporting</h2>
      <p className="muted auth-copy">
        If episode {episodeNumber} will not play, send one report every 24
        hours. This helps rank unstable hosts and track repeated issues.
      </p>

      <div className="hero-actions">
        <button
          type="button"
          className="button primary"
          disabled={isLoading || isSubmitting || !status?.canReport}
          onClick={() => void reportBroken()}
        >
          {isLoading
            ? "Loading..."
            : isSubmitting
              ? "Sending..."
              : status?.canReport
                ? "Report Broken Episode"
                : "Already Reported Recently"}
        </button>
      </div>

      {status ? (
        <div className="report-stats">
          <span>{status.reportsLast24h} reports in 24h</span>
          <span>{status.totalReports} total reports</span>
          {!status.canReport && status.nextReportAt ? (
            <span>Available again: {formatDateTime(status.nextReportAt)}</span>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="watch-sync-note success">{message}</p> : null}
      {error ? <p className="watch-sync-note error">{error}</p> : null}
    </div>
  );
}
