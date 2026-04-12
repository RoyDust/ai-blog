import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useInspectorState<T extends string>({
  defaultPanel,
  allowedPanels,
}: {
  defaultPanel: T;
  allowedPanels: readonly T[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = searchParams.get("panel") as T | null;
  const panel = current && allowedPanels.includes(current) ? current : defaultPanel;

  function setPanel(nextPanel: T) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panel", nextPanel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return { panel, setPanel };
}

