"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Rocket, Sparkles } from "lucide-react";
import { resolveModuleLaunch } from "../_lib/module-launch";
import "./go-live.css";

/** Total time the celebration holds before the route change is issued. */
const LAUNCH_MS = 2800;
/** Time the overlay spends fading out after the redirect is issued. */
const FADE_MS = 400;

/**
 * Full-screen launch experience shown when a module's onboarding is signed off
 * and the user presses "Go live".
 *
 * Everything animates in CSS (see go-live.css alongside) rather than through an
 * animation library — this app ships no motion runtime, and a celebration is
 * not a good reason to put one in every bundle. The ring, rocket, confetti and
 * particles are transform/opacity only, so they stay on the compositor.
 *
 * Under `prefers-reduced-motion` the whole thing collapses: the card appears at
 * its final state, nothing moves, and the redirect happens almost immediately.
 * That is the media query in go-live.css plus the shortened hold below.
 */
export function GoLiveOverlay({
  moduleKey,
  moduleName,
  onDismiss,
}: {
  moduleKey: string;
  /** The module's display name, e.g. "Fees Management". */
  moduleName: string;
  /** Called if the user backs out before the redirect fires. */
  onDismiss: () => void;
}) {
  const router = useRouter();
  const target = useMemo(() => resolveModuleLaunch(moduleKey), [moduleKey]);
  const ModuleIcon = target.icon;

  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Read once on mount: the celebration's whole schedule depends on it, and a
  // mid-flight change must not leave the user stranded on the overlay.
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hold = reducedMotion.current ? 600 : LAUNCH_MS;
    const fade = reducedMotion.current ? 0 : FADE_MS;

    // The dashboards are heavy client routes; warming this one while the rocket
    // flies means the redirect lands on a rendered page rather than a spinner.
    router.prefetch(target.route);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let tick = 0;

    if (reducedMotion.current) {
      setPercent(100);
      setPhase(3);
    } else {
      // Ring fill: stepped to 100 across the hold so the readout and the stroke
      // finish together, just before the checkmark lands.
      const startedAt = performance.now();
      tick = window.setInterval(() => {
        const ratio = Math.min(1, (performance.now() - startedAt) / (LAUNCH_MS - 500));
        // Ease-out cubic, so it races ahead early and settles on 100 rather
        // than crawling through the last few percent.
        setPercent(Math.round((1 - Math.pow(1 - ratio, 3)) * 100));
        if (ratio >= 1) window.clearInterval(tick);
      }, 40);

      timers.push(setTimeout(() => setPhase(1), 900));
      timers.push(setTimeout(() => setPhase(2), 1700));
      timers.push(setTimeout(() => setPhase(3), LAUNCH_MS - 500));
    }

    timers.push(setTimeout(() => setLeaving(true), hold));
    timers.push(setTimeout(() => router.push(target.route), hold + fade));

    return () => {
      timers.forEach(clearTimeout);
      if (tick) window.clearInterval(tick);
    };
  }, [router, target.route]);

  // The button that opened the overlay is still mounted behind it, so focus is
  // moved onto the card — otherwise a screen reader would keep announcing the
  // onboarding page underneath while the launch plays.
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // Escape is the only way out. The overlay announces a launch that has already
  // happened, so it offers no close button competing with that message.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !leaving) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leaving, onDismiss]);

  const messages = [
    "Setup complete",
    `Your ${moduleName} workspace is ready`,
    "Launching your workspace…",
  ];
  const headline = messages[Math.min(phase, messages.length - 1)];

  // Ring geometry — r=54 inside a 120 box leaves room for the 8px stroke.
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={`golive-root${leaving ? " is-leaving" : ""}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={`${moduleName} is going live`}
    >
      {/* Purple → blue glow washing the white canvas: two offset radials that
          breathe slowly, so the background never reads as a flat scrim. */}
      <div className="golive-glow" aria-hidden />

      {/* Floating particles. Positions are index-derived rather than random so
          the first client render matches the markup React already committed. */}
      <div className="golive-particles" aria-hidden>
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="golive-particle"
            style={{
              left: `${(index * 37) % 100}%`,
              animationDelay: `${(index % 6) * 0.45}s`,
              animationDuration: `${7 + (index % 5)}s`,
              background: index % 2 ? "#6366f1" : "#3b82f6",
            }}
          />
        ))}
      </div>

      {/* Confetti burst, released with the checkmark. Fanned by index so the
          spread is even rather than clumped. */}
      {phase >= 3 ? (
        <div className="golive-confetti" aria-hidden>
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              className="golive-confetto"
              style={{
                ["--golive-angle" as string]: `${index * 15}deg`,
                ["--golive-distance" as string]: `${140 + (index % 5) * 46}px`,
                animationDelay: `${(index % 4) * 0.05}s`,
                background: ["#6366f1", "#3b82f6", "#a855f7", "#22c55e"][index % 4],
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="golive-card" ref={cardRef} tabIndex={-1}>
        <div className="golive-ring-wrap">
          <svg className="golive-ring" viewBox="0 0 120 120" aria-hidden>
            <circle className="golive-ring-track" cx="60" cy="60" r={radius} />
            <circle
              className="golive-ring-fill"
              cx="60"
              cy="60"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
            />
          </svg>

          {/* The rocket lifts through the ring, hands over to the glowing module
              mark, and finally to the checkmark. Only one is mounted at a time,
              so nothing overlaps mid-transition. */}
          <div className="golive-ring-center">
            {phase >= 3 ? (
              <span className="golive-check">
                <Check className="size-8" strokeWidth={3} aria-hidden />
              </span>
            ) : phase >= 2 ? (
              <span className="golive-module-mark">
                <ModuleIcon className="size-9" aria-hidden />
              </span>
            ) : (
              <span className="golive-rocket">
                <Rocket className="size-9" aria-hidden />
              </span>
            )}
          </div>

          <p className="golive-percent" aria-hidden>
            {percent}%
          </p>
        </div>

        <p className="golive-eyebrow">
          <Sparkles className="size-3.5" aria-hidden />
          Going live
        </p>

        {/* aria-live so a screen reader hears each stage, not only whichever one
            happened to be rendered when the dialog opened. */}
        <h2 className="golive-headline" aria-live="polite">
          {headline}
        </h2>

        <p className="golive-body">All configurations have been verified successfully.</p>

        <p className="golive-footnote">
          {target.isFallback
            ? "Redirecting to your dashboard…"
            : "Redirecting to the module dashboard…"}
        </p>

        <div className="golive-progress" aria-hidden>
          <span className="golive-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
