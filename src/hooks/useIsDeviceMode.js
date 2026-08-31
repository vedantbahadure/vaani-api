import { useMode } from "../lib/contexts";

export function useIsDeviceMode() {
  const { mode } = useMode();
  return mode === "device";
}
