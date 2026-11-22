"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";

const LazyPublicCommandSearchDialog = dynamic(
  () => import("./PublicCommandSearchDialog").then((mod) => mod.PublicCommandSearchDialog),
  { ssr: false },
);

function subscribeNoop() {
  return () => {};
}

function getClientShortcutLabel() {
  if (typeof window !== "undefined" && /Mac|iPhone|iPad|iPod/.test(window.navigator.platform)) {
    return "⌘K";
  }
  return "Ctrl K";
}

function getServerShortcutLabel() {
  return "Ctrl K";
}

export function PublicCommandSearch() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const shortcutLabel = useSyncExternalStore(
    subscribeNoop,
    getClientShortcutLabel,
    getServerShortcutLabel,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHasOpened(true);
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleTriggerClick() {
    setHasOpened(true);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        aria-label="快速搜索与命令面板"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`快速搜索 (${shortcutLabel})`}
        onClick={handleTriggerClick}
        className="hidden h-8.5 shrink-0 items-center gap-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-2 font-mono text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] sm:inline-flex"
      >
        <span>{shortcutLabel}</span>
      </button>

      {hasOpened ? (
        <LazyPublicCommandSearchDialog
          open={open}
          onOpenChange={setOpen}
          shortcutLabel={shortcutLabel}
        />
      ) : null}
    </>
  );
}
