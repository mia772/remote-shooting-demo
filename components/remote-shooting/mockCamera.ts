export type CameraMode = "M" | "A";
export type CameraStatus = "connecting" | "online" | "offline" | "error";
export type ISOValue = "Auto" | 200 | 400 | 800 | 1600 | 3200 | 6400;
export type WhiteBalance =
  | "自动白平衡"
  | "晴天"
  | "阴天"
  | "阴影"
  | "人造光"
  | "闪光灯"
  | "色温";
export type FilterPreset =
  | "Greg Williams"
  | "Bleach"
  | "Teal"
  | "Eternal"
  | "Contemporary"
  | "Natural"
  | "Cine";
export type TimerValue = null | 3 | 5 | 10;
export type CameraOperation =
  | "mode"
  | "iso"
  | "ev"
  | "wb"
  | "kelvin"
  | "filter"
  | "timer"
  | "gestureTimer"
  | "grid"
  | "focus"
  | "capture"
  | "recording";

type MockConfiguration = {
  initialStatus?: Exclude<CameraStatus, "connecting">;
  failNext?: CameraOperation | null;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

class MockCameraCommandError extends Error {
  constructor(public operation: CameraOperation) {
    super(`Mock camera rejected ${operation}`);
    this.name = "MockCameraCommandError";
  }
}

let configuration: Required<MockConfiguration> = {
  initialStatus: "online",
  failNext: null,
};

const complete = async (operation: CameraOperation, milliseconds: number) => {
  await wait(milliseconds);
  if (configuration.failNext === operation) {
    configuration.failNext = null;
    throw new MockCameraCommandError(operation);
  }
};

export const mockCamera = {
  configure(nextConfiguration: MockConfiguration) {
    configuration = {
      initialStatus: nextConfiguration.initialStatus ?? "online",
      failNext: nextConfiguration.failNext ?? null,
    };
  },

  async connect() {
    await wait(620);
    return {
      status: configuration.initialStatus,
      batteryPercent: 89,
      sdRemainingGb: 54,
    };
  },

  async reconnect() {
    await wait(720);
    configuration.initialStatus = "online";
    return {
      status: "online" as const,
      batteryPercent: 89,
      sdRemainingGb: 54,
    };
  },

  async setMode(mode: CameraMode) {
    await complete("mode", 220);
    return {
      mode,
      autoISO: 400 as const,
      manualISO: 400 as const,
      autoShutter: "1/100s",
      manualShutter: "1/100s",
      autoWhiteBalance: "自动白平衡" as const,
    };
  },

  async setISO(iso: ISOValue) {
    await complete("iso", 160);
    return iso;
  },

  async setEV(ev: number) {
    await complete("ev", 140);
    return ev;
  },

  async setWhiteBalance(whiteBalance: WhiteBalance) {
    await complete("wb", 160);
    return whiteBalance;
  },

  async setKelvin(kelvin: number) {
    await complete("kelvin", 140);
    return kelvin;
  },

  async setFilter(filter: FilterPreset) {
    await complete("filter", 120);
    return filter;
  },

  async setTimer(timer: TimerValue) {
    await complete("timer", 100);
    return timer;
  },

  async setGestureTimer(timer: TimerValue) {
    await complete("gestureTimer", 100);
    return timer;
  },

  async setGrid(enabled: boolean) {
    await complete("grid", 80);
    return enabled;
  },

  async focus(x: number, y: number) {
    await complete("focus", 320);
    return { x, y };
  },

  async capturePhoto() {
    await complete("capture", 460);
    return { capturedAt: Date.now() };
  },

  async startRecording() {
    await complete("recording", 220);
    return { startedAt: Date.now() };
  },

  async stopRecording() {
    await complete("recording", 180);
    return { stoppedAt: Date.now() };
  },
};
