export interface HardwareProfile {
  name: string;
  description: string;
  capabilities: {
    microphone: { available: boolean; driver: string | null };
    speaker: { available: boolean; driver: string | null };
    camera: { available: boolean; driver: string | null };
    gpio: { available: boolean; driver: string | null };
    display: { available: boolean; driver: string | null };
  };
}

export const HARDWARE_PROFILES: Record<string, HardwareProfile> = {
  mock: {
    name: "mock",
    description: "Cloud / browser environment. Audio I/O handled client-side (Web APIs).",
    capabilities: {
      microphone: { available: true, driver: "web-mediarecorder" },
      speaker: { available: true, driver: "web-audio" },
      camera: { available: false, driver: null },
      gpio: { available: false, driver: null },
      display: { available: true, driver: "browser" },
    },
  },
  laptop: {
    name: "laptop",
    description: "Developer laptop. OS default microphone and speaker.",
    capabilities: {
      microphone: { available: true, driver: "os-default" },
      speaker: { available: true, driver: "os-default" },
      camera: { available: true, driver: "os-webcam" },
      gpio: { available: false, driver: null },
      display: { available: true, driver: "os-window" },
    },
  },
  raspberry_pi: {
    name: "raspberry_pi",
    description: "Raspberry Pi kiosk. arecord/aplay audio, GPIO buttons/LEDs, touch display.",
    capabilities: {
      microphone: { available: true, driver: "alsa-arecord" },
      speaker: { available: true, driver: "alsa-aplay" },
      camera: { available: true, driver: "picamera2" },
      gpio: { available: true, driver: "rpi.gpio" },
      display: { available: true, driver: "dsi-touch" },
    },
  },
  esp32: {
    name: "esp32",
    description: "ESP32 edge node. I2S mic/DAC over serial/MQTT bridge.",
    capabilities: {
      microphone: { available: true, driver: "i2s-serial" },
      speaker: { available: true, driver: "i2s-dac" },
      camera: { available: false, driver: null },
      gpio: { available: true, driver: "esp32-gpio" },
      display: { available: true, driver: "spi-oled" },
    },
  },
};

export function getHardware(): HardwareProfile {
  const mode = process.env.VAANI_HARDWARE || "mock";
  return HARDWARE_PROFILES[mode] || HARDWARE_PROFILES.mock;
}
