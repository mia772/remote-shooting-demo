"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CameraMode,
  type CameraOperation,
  type CameraStatus,
  type FilterPreset,
  type ISOValue,
  type TimerValue,
  type WhiteBalance,
  mockCamera,
} from "./mockCamera";
import styles from "./RemoteShootingDemo.module.css";

type FocusPoint = { x: number; y: number };
type CaptureMode = "photo" | "video";
type FlashMode = "off" | "auto" | "on";
type ZoomLevel = 1 | 2 | 4;
type Rotation = 0 | 90 | 180 | 270;
type ActivePanel = "gesture" | "flash" | "settings" | "iso" | "ev" | "wb" | "kelvin" | "filter" | null;

const ASSET = "/figma-page3/";
const ISO_OPTIONS: ISOValue[] = ["Auto", 200, 400, 800, 1600, 3200, 6400];
const WB_OPTIONS: WhiteBalance[] = ["自动白平衡", "人造光", "阴天", "晴天", "阴影", "闪光灯", "色温"];
const FILTER_OPTIONS: FilterPreset[] = ["Natural", "Greg Williams", "Bleach", "Teal", "Eternal", "Contemporary", "Cine"];
const FILTER_LABELS: Record<FilterPreset, string> = {
  Natural: "原片",
  "Greg Williams": "Greg Williams",
  Bleach: "Bleach",
  Teal: "Teal",
  Eternal: "Eternal",
  Contemporary: "Contemporary",
  Cine: "Cine",
};
const DELAY_OPTIONS: TimerValue[] = [null, 3, 5, 10];
const EV_OPTIONS = [-2, -1, 0, 1, 2] as const;
const PARAMETER_WHEEL_STEP = 78;
const WB_FILTERS: Record<WhiteBalance, string> = {
  自动白平衡: "",
  晴天: "sepia(.08) saturate(1.06)",
  阴天: "sepia(.2) saturate(1.08)",
  阴影: "sepia(.3) saturate(1.08)",
  人造光: "hue-rotate(13deg) saturate(.88)",
  闪光灯: "brightness(1.04) saturate(.94)",
  色温: "sepia(.18) saturate(1.02)",
};
const FILTER_STYLES: Record<FilterPreset, string> = {
  Natural: "",
  "Greg Williams": "contrast(1.14) saturate(.82) sepia(.1)",
  Bleach: "grayscale(.5) contrast(1.2) saturate(.48)",
  Teal: "hue-rotate(150deg) saturate(.72) contrast(1.08)",
  Eternal: "contrast(.96) saturate(.78) sepia(.16)",
  Contemporary: "contrast(1.08) saturate(.9)",
  Cine: "contrast(1.14) saturate(.7) sepia(.12)",
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
const formatEV = (value: number, detail = false) => {
  const text = detail ? value.toFixed(1) : Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value > 0 ? `+${text}` : text;
};
const delayLabel = (value: TimerValue) => value ? `${value} 秒` : "Off";
const formatRecordingTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

function WhiteBalanceGlyph({ value, compact = false, kelvin = 5600 }: { value: WhiteBalance; compact?: boolean; kelvin?: number }) {
  if (value === "自动白平衡") return <img src={`${ASSET}wb-auto.svg`} alt="" />;
  if (value === "晴天") return <img src={`${ASSET}wb-sun.svg`} alt="" />;
  if (value === "阴天") return <img src={`${ASSET}wb-cloud.svg`} alt="" />;
  if (value === "阴影") return <img src={`${ASSET}wb-shade.svg`} alt="" />;
  if (value === "闪光灯") return <img src={`${ASSET}flash-on.svg`} alt="" />;
  if (value === "色温") return <span className={styles.kelvinGlyph}>{kelvin}K</span>;
  return <span className={styles.tungstenGlyph} aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}

export function RemoteShootingDemo() {
  const connectionRequestRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isoWheelRef = useRef<HTMLDivElement>(null);
  const evWheelRef = useRef<HTMLDivElement>(null);
  const isoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("connecting");
  const [mode, setMode] = useState<CameraMode>("M");
  const [iso, setISO] = useState<ISOValue>(400);
  const [ev, setEV] = useState(-2);
  const [whiteBalance, setWhiteBalance] = useState<WhiteBalance>("自动白平衡");
  const [kelvin, setKelvin] = useState(5600);
  const [filter, setFilter] = useState<FilterPreset>("Natural");
  const [shutterDelay, setShutterDelay] = useState<TimerValue>(null);
  const [gestureDelay, setGestureDelay] = useState<TimerValue>(null);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>("auto");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [focusPoint, setFocusPoint] = useState<FocusPoint>({ x: 50, y: 50 });
  const [isFocusing, setIsFocusing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showCaptureFlash, setShowCaptureFlash] = useState(false);
  const [pendingControl, setPendingControl] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [topNotice, setTopNotice] = useState<string | null>(null);
  const cameraReady = cameraStatus === "online";

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedStatus = query.get("camera");
    const fail = query.get("fail");
    const statuses: CameraStatus[] = ["online", "offline", "error"];
    const operations: CameraOperation[] = ["mode", "iso", "ev", "wb", "kelvin", "filter", "timer", "gestureTimer", "grid", "focus", "capture", "recording"];
    mockCamera.configure({
      initialStatus: statuses.includes(requestedStatus as CameraStatus) ? requestedStatus as Exclude<CameraStatus, "connecting"> : "online",
      failNext: operations.includes(fail as CameraOperation) ? fail as CameraOperation : null,
    });
    const request = ++connectionRequestRef.current;
    void mockCamera.connect().then((connection) => {
      if (request !== connectionRequestRef.current) return;
      setCameraStatus(connection.status);
      setAnnouncement(connection.status === "online" ? "相机已连接" : "相机当前不可用");
    });
    return () => { connectionRequestRef.current += 1; };
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    const orientation = window.screen.orientation;
    const syncOrientation = () => {
      const angle = orientation?.angle ?? 0;
      if (angle === 0 || angle === 90 || angle === 180 || angle === 270) setRotation(angle as Rotation);
    };
    syncOrientation();
    orientation?.addEventListener?.("change", syncOrientation);
    return () => orientation?.removeEventListener?.("change", syncOrientation);
  }, []);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (isoScrollTimerRef.current) clearTimeout(isoScrollTimerRef.current);
    if (evScrollTimerRef.current) clearTimeout(evScrollTimerRef.current);
  }, []);

  useEffect(() => {
    if (activePanel !== "iso") return;
    const frame = requestAnimationFrame(() => {
      const index = Math.max(0, ISO_OPTIONS.indexOf(iso));
      isoWheelRef.current?.scrollTo({ left: index * PARAMETER_WHEEL_STEP });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== "ev") return;
    const frame = requestAnimationFrame(() => {
      const index = Math.max(0, EV_OPTIONS.indexOf(Math.round(ev) as (typeof EV_OPTIONS)[number]));
      evWheelRef.current?.scrollTo({ left: index * PARAMETER_WHEEL_STEP });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePanel]);

  const notify = (message: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(message);
    setAnnouncement(message);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1600);
  };
  const showTopNotice = (message: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setTopNotice(message);
    noticeTimerRef.current = setTimeout(() => setTopNotice(null), 1000);
  };
  const closePanel = () => setActivePanel(null);
  const togglePanel = (panel: ActivePanel) => {
    setTopNotice(null);
    setActivePanel((current) => current === panel ? null : panel);
  };

  const setModeAndSync = async () => {
    if (!cameraReady || pendingControl) return;
    const previous = mode;
    const next: CameraMode = mode === "M" ? "A" : "M";
    setMode(next);
    setPendingControl("mode");
    try {
      const result = await mockCamera.setMode(next);
      setMode(result.mode);
      setISO(result.mode === "A" ? result.autoISO : result.manualISO);
      if (result.mode === "A") setWhiteBalance(result.autoWhiteBalance);
      setAnnouncement(`已切换至 ${result.mode} 模式`);
    } catch {
      setMode(previous);
      notify("模式切换失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const selectISO = async (value: ISOValue) => {
    if (!cameraReady || mode === "A") return;
    const previous = iso;
    setISO(value);
    setPendingControl("iso");
    try {
      setISO(await mockCamera.setISO(value));
      setAnnouncement(`ISO 已设置为 ${value === "Auto" ? "自动" : value}`);
    } catch {
      setISO(previous);
      notify("ISO 调整失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const commitEV = async (value: number) => {
    if (!cameraReady) return;
    const next = Math.round(clamp(value, -2, 2) * 10) / 10;
    const previous = ev;
    setEV(next);
    setPendingControl("ev");
    try {
      setEV(await mockCamera.setEV(next));
      setAnnouncement(`EV ${formatEV(next, true)}`);
    } catch {
      setEV(previous);
      notify("EV 调整失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const selectWhiteBalance = async (value: WhiteBalance) => {
    const previous = whiteBalance;
    setWhiteBalance(value);
    setPendingControl("wb");
    try {
      const confirmed = await mockCamera.setWhiteBalance(value);
      setWhiteBalance(confirmed);
      setActivePanel(confirmed === "色温" ? "kelvin" : "wb");
      setAnnouncement(`白平衡已设置为 ${confirmed}`);
    } catch {
      setWhiteBalance(previous);
      notify("白平衡调整失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const commitKelvin = async (value: number) => {
    const previous = kelvin;
    setKelvin(value);
    setPendingControl("kelvin");
    try {
      setKelvin(await mockCamera.setKelvin(value));
      setAnnouncement(`色温已设置为 ${value}K`);
    } catch {
      setKelvin(previous);
      notify("色温调整失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const selectFilter = async (value: FilterPreset) => {
    const previous = filter;
    setFilter(value);
    setPendingControl("filter");
    try {
      setFilter(await mockCamera.setFilter(value));
      setAnnouncement(`滤镜预览：${FILTER_LABELS[value]}`);
    } catch {
      setFilter(previous);
      notify("滤镜调整失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const selectShutterDelay = async (value: TimerValue) => {
    const previous = shutterDelay;
    setShutterDelay(value);
    setPendingControl("timer");
    try {
      setShutterDelay(await mockCamera.setTimer(value));
      setAnnouncement(`快门延时：${value ? `${value} 秒` : "关闭"}`);
    } catch {
      setShutterDelay(previous);
      notify("快门延时设置失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const selectGestureDelay = async (value: TimerValue) => {
    const previous = gestureDelay;
    setGestureDelay(value);
    setPendingControl("gestureTimer");
    try {
      const confirmed = await mockCamera.setGestureTimer(value);
      setGestureDelay(confirmed);
      closePanel();
      showTopNotice(`手势延迟拍照 ${delayLabel(confirmed)}`);
      setAnnouncement(`手势延迟拍照：${delayLabel(confirmed)}`);
    } catch {
      setGestureDelay(previous);
      notify("手势延迟拍照设置失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const selectFlash = (value: FlashMode) => {
    setFlashMode(value);
    closePanel();
    const label = value === "off" ? "关闭" : value === "auto" ? "自动" : "打开";
    showTopNotice(`闪光灯 ${label}`);
    setAnnouncement(`闪光灯 ${label}`);
  };

  const selectGrid = async (value: boolean) => {
    const previous = gridEnabled;
    setGridEnabled(value);
    setPendingControl("grid");
    try {
      setGridEnabled(await mockCamera.setGrid(value));
      setAnnouncement(`网格已${value ? "开启" : "关闭"}`);
    } catch {
      setGridEnabled(previous);
      notify("网格设置失败，已恢复原设置");
    } finally { setPendingControl(null); }
  };

  const setFocus = async (point: FocusPoint) => {
    if (!cameraReady) return;
    setFocusPoint(point);
    setIsFocusing(true);
    try {
      await mockCamera.focus(point.x, point.y);
      setAnnouncement("对焦完成");
    } catch { notify("对焦失败，请重试"); }
    finally { setIsFocusing(false); }
  };

  const rotateLiveView = () => {
    const next = ((rotation + 90) % 360) as Rotation;
    setRotation(next);
    setAnnouncement(`实时取景已旋转 ${next} 度`);
  };

  const handleLivePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cameraReady) return;
    if (event.altKey) { rotateLiveView(); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    void setFocus({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 8, 92),
    });
  };

  const capturePhoto = async () => {
    setIsCapturing(true);
    setShowCaptureFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setShowCaptureFlash(false), 105);
    try {
      await mockCamera.capturePhoto();
      setAnnouncement("照片已拍摄");
    } catch { notify("拍摄失败，请检查相机与 SD 卡状态"); }
    finally { setIsCapturing(false); }
  };

  const runCountdown = async (delay: TimerValue, kind: "快门" | "手势") => {
    if (!delay) { await capturePhoto(); return; }
    for (let second = delay; second > 0; second -= 1) {
      setCountdown(second);
      setAnnouncement(`${kind}拍摄倒计时 ${second}`);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
    }
    setCountdown(null);
    await capturePhoto();
  };

  const handleShutter = async () => {
    if (!cameraReady || isCapturing || countdown !== null || pendingControl) return;
    closePanel();
    if (captureMode === "photo") { await runCountdown(shutterDelay, "快门"); return; }
    setPendingControl("recording");
    try {
      if (isRecording) {
        await mockCamera.stopRecording();
        setIsRecording(false);
        setAnnouncement("录像已停止");
      } else {
        await mockCamera.startRecording();
        setRecordingSeconds(0);
        setIsRecording(true);
        setAnnouncement("录像已开始");
      }
    } catch { notify(isRecording ? "停止录像失败" : "录像启动失败"); }
    finally { setPendingControl(null); }
  };

  const triggerGestureCapture = () => {
    if (!gestureDelay) { showTopNotice("手势延迟拍照 Off"); return; }
    if (captureMode !== "photo" || isCapturing || countdown !== null) return;
    void runCountdown(gestureDelay, "手势");
  };

  const cycleZoom = (value: ZoomLevel) => {
    if (zoomLevel !== value) { setZoomLevel(value); return; }
    setZoomLevel(value === 1 ? 2 : value === 2 ? 4 : 1);
  };

  const settleISOWheel = (element: HTMLDivElement) => {
    const index = clamp(Math.round(element.scrollLeft / PARAMETER_WHEEL_STEP), 0, ISO_OPTIONS.length - 1);
    const value = ISO_OPTIONS[index];
    setISO(value);
    element.scrollTo({ left: index * PARAMETER_WHEEL_STEP, behavior: "smooth" });
    void selectISO(value);
  };

  const handleISOWheelScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const index = clamp(Math.round(element.scrollLeft / PARAMETER_WHEEL_STEP), 0, ISO_OPTIONS.length - 1);
    setISO(ISO_OPTIONS[index]);
    if (isoScrollTimerRef.current) clearTimeout(isoScrollTimerRef.current);
    isoScrollTimerRef.current = setTimeout(() => settleISOWheel(element), 120);
  };

  const chooseISO = (value: ISOValue, index: number) => {
    setISO(value);
    isoWheelRef.current?.scrollTo({ left: index * PARAMETER_WHEEL_STEP, behavior: "smooth" });
    if (isoScrollTimerRef.current) clearTimeout(isoScrollTimerRef.current);
    isoScrollTimerRef.current = setTimeout(() => {
      if (isoWheelRef.current) settleISOWheel(isoWheelRef.current);
    }, 160);
  };

  const settleEVWheel = (element: HTMLDivElement) => {
    const index = clamp(Math.round(element.scrollLeft / PARAMETER_WHEEL_STEP), 0, EV_OPTIONS.length - 1);
    const value = EV_OPTIONS[index];
    setEV(value);
    element.scrollTo({ left: index * PARAMETER_WHEEL_STEP, behavior: "smooth" });
    void commitEV(value);
  };

  const handleEVWheelScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const index = clamp(Math.round(element.scrollLeft / PARAMETER_WHEEL_STEP), 0, EV_OPTIONS.length - 1);
    setEV(EV_OPTIONS[index]);
    if (evScrollTimerRef.current) clearTimeout(evScrollTimerRef.current);
    evScrollTimerRef.current = setTimeout(() => settleEVWheel(element), 120);
  };

  const chooseEV = (value: (typeof EV_OPTIONS)[number], index: number) => {
    setEV(value);
    evWheelRef.current?.scrollTo({ left: index * PARAMETER_WHEEL_STEP, behavior: "smooth" });
    if (evScrollTimerRef.current) clearTimeout(evScrollTimerRef.current);
    evScrollTimerRef.current = setTimeout(() => {
      if (evWheelRef.current) settleEVWheel(evWheelRef.current);
    }, 160);
  };

  const translateVerticalWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY;
  };

  const exposureBrightness = .86 + ((ev + 2) / 4) * .3;
  const kelvinFilter = whiteBalance !== "色温" ? WB_FILTERS[whiteBalance] : kelvin < 5500
    ? `sepia(${((5500 - kelvin) / 3000) * .34}) saturate(1.08)`
    : `hue-rotate(${((kelvin - 5500) / 4500) * 18}deg) saturate(.94)`;
  const liveViewFilter = [`brightness(${exposureBrightness.toFixed(2)})`, kelvinFilter, FILTER_STYLES[filter]].filter(Boolean).join(" ");
  const flashAsset = flashMode === "off" ? "flash-off.svg" : flashMode === "auto" ? "flash-auto.svg" : "flash-on.svg";
  const gestureAsset = gestureDelay ? "gesture-on.svg" : "gesture-off.svg";
  const isoBaseDisplay = iso === "Auto" ? "Auto" : String(iso);
  const isoDisplay = mode === "A" ? `A${iso === "Auto" ? 400 : iso}` : isoBaseDisplay;
  const evDisplay = mode === "A" ? `A${formatEV(ev)}` : formatEV(ev);
  const shutterDisplay = mode === "A" ? "A1/100s" : "1/100s";
  const parameterPanelOpen = ["iso", "ev", "wb", "kelvin", "filter"].includes(activePanel ?? "");

  return (
    <section className={styles.cameraApp} aria-label="专业相机远程拍摄">
      <header className={styles.topChrome}>
        <div className={styles.systemBar} aria-label="系统状态">
          <time dateTime="12:13">12:13</time>
          <span className={styles.systemIcons} aria-hidden="true">
            <img src={`${ASSET}system-signal.svg`} alt="" /><img src={`${ASSET}system-wifi.svg`} alt="" /><img src={`${ASSET}system-battery.svg`} alt="" />
          </span>
        </div>
        <nav className={styles.cameraBar} aria-label="相机状态与快速控制">
          <button className={styles.closeButton} type="button" aria-label="关闭远程拍摄连接" onClick={() => setCameraStatus("offline")}><img src={`${ASSET}close.svg`} alt="" /></button>
          <span className={styles.batteryReadout}>89% <span className={styles.cameraBattery} aria-hidden="true"><i /><i /></span></span>
          <span className={styles.telemetryDivider} aria-hidden="true" />
          <span className={styles.capacityReadout}>{captureMode === "photo" ? "1234 张" : "44:34 可录"}</span>
          <div className={styles.topControlGroup}>
            <button className={activePanel === "gesture" ? styles.topControlActive : ""} type="button" aria-label="手势延迟拍照" aria-expanded={activePanel === "gesture"} onClick={() => togglePanel("gesture")}><img src={`${ASSET}${gestureAsset}`} alt="" /></button>
            <button className={activePanel === "flash" ? styles.topControlActive : ""} type="button" aria-label={`闪光灯，当前 ${flashMode}`} aria-expanded={activePanel === "flash"} onClick={() => togglePanel("flash")}><img src={`${ASSET}${flashAsset}`} alt="" /></button>
            <button className={activePanel === "settings" ? styles.topControlActive : ""} type="button" aria-label="设置" aria-expanded={activePanel === "settings"} onClick={() => togglePanel("settings")}><img src={`${ASSET}settings.svg`} alt="" /></button>
          </div>
        </nav>
        {topNotice && <p className={styles.topNotice} role="status">{topNotice}</p>}
      </header>

      <div className={styles.liveViewStage}>
        <div className={`${styles.liveView} ${!cameraReady ? styles.liveViewUnavailable : ""}`} role="button" tabIndex={cameraReady ? 0 : -1} aria-label="实时取景。点击改变对焦位置；双击模拟手势拍照；设备横转时取景随方向旋转" onPointerDown={handleLivePointer} onDoubleClick={triggerGestureCapture} onKeyDown={(event) => {
          if (event.key.toLowerCase() === "r") { event.preventDefault(); rotateLiveView(); }
          if (event.key.toLowerCase() === "g") { event.preventDefault(); triggerGestureCapture(); }
        }}>
          <span className={styles.liveViewTransform} style={{ transform: `scale(${zoomLevel}) rotate(${rotation}deg)` }} aria-hidden="true"><img className={styles.liveViewImage} src={`${ASSET}live-view.png`} alt="" draggable={false} style={{ filter: liveViewFilter }} /></span>
          {gridEnabled && <span className={styles.gridOverlay} aria-hidden="true"><i /><i /><i /><i /></span>}
          <img className={`${styles.focusTarget} ${isFocusing ? styles.focusTargetActive : ""}`} src={`${ASSET}focus.svg`} alt="" style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }} />
          {countdown !== null && <output className={styles.countdown} aria-label={`拍摄倒计时 ${countdown} 秒`}>{countdown}</output>}
          {isRecording && <output className={styles.recordingStatus}><i aria-hidden="true" />REC {formatRecordingTime(recordingSeconds)}</output>}
          <span className={`${styles.captureFlash} ${showCaptureFlash ? styles.captureFlashVisible : ""}`} aria-hidden="true" />
          {feedback && <span className={styles.feedback} role="status">{feedback}</span>}
          {!cameraReady && <span className={styles.connectionOverlay}>{cameraStatus === "connecting" ? "正在连接相机…" : "相机离线"}</span>}
        </div>
        <div className={styles.zoomRail} role="group" aria-label="取景倍率">{([1, 2, 4] as const).map((value) => <button key={value} className={zoomLevel === value ? styles.zoomSelected : ""} type="button" aria-pressed={zoomLevel === value} disabled={!cameraReady} onClick={() => cycleZoom(value)}>{value === 1 ? "1x" : value}</button>)}</div>
      </div>

      <button className={styles.modeBadge} type="button" aria-label={`当前曝光模式 ${mode}，点击切换`} onClick={() => void setModeAndSync()} disabled={!cameraReady}>{mode}</button>

      <div className={`${styles.parameterRow} ${mode === "A" ? styles.aMode : ""}`} role="group" aria-label="拍摄参数">
        <button className={`${styles.parameter} ${styles.isoParameter}`} type="button" aria-label={`ISO ${isoDisplay}`} aria-disabled={mode === "A"} onClick={() => mode === "A" ? notify("A 模式下 ISO 由相机自动控制") : togglePanel("iso")}><span>ISO</span><strong>{isoDisplay}</strong></button>
        <button className={`${styles.parameter} ${styles.evParameter}`} type="button" aria-label={`EV ${evDisplay}`} onClick={() => togglePanel("ev")}><span>EV</span><strong>{evDisplay}</strong></button>
        <button className={`${styles.parameter} ${styles.shutterParameter}`} type="button" aria-label={`快门 ${shutterDisplay}`} aria-disabled={mode === "A"} onClick={() => mode === "A" && notify("A 模式下快门由相机自动控制")}><span>快门</span><strong>{shutterDisplay}</strong></button>
        <button className={`${styles.parameter} ${styles.wbParameter}`} type="button" aria-label={`白平衡 ${whiteBalance === "色温" ? `${kelvin}K` : whiteBalance}`} onClick={() => togglePanel("wb")}><span>白平衡</span><strong className={styles.wbValue}><WhiteBalanceGlyph value={whiteBalance} compact kelvin={kelvin} /></strong></button>
      </div>

      <button className={styles.filterButton} type="button" aria-label="滤镜" aria-expanded={activePanel === "filter"} onClick={() => togglePanel("filter")}><img src={`${ASSET}filter.svg`} alt="" /></button>
      <button className={`${styles.shutterButton} ${isRecording ? styles.shutterRecording : ""}`} type="button" aria-label={isRecording ? "停止录像" : captureMode === "video" ? "开始录像" : "拍照"} disabled={!cameraReady || isCapturing || countdown !== null || pendingControl === "recording"} onClick={() => void handleShutter()}>{!isRecording && <img src={`${ASSET}shutter.svg`} alt="" />}{isRecording && <span aria-hidden="true" />}</button>
      <div className={`${styles.captureModes} ${captureMode === "video" ? styles.videoSelected : ""}`} role="group" aria-label="拍摄模式"><button className={captureMode === "photo" ? styles.captureModeSelected : ""} type="button" aria-pressed={captureMode === "photo"} disabled={isRecording} onClick={() => setCaptureMode("photo")}>照片</button><button className={captureMode === "video" ? styles.captureModeSelected : ""} type="button" aria-pressed={captureMode === "video"} onClick={() => setCaptureMode("video")}>视频</button></div>

      {activePanel && <button className={styles.dismissLayer} type="button" aria-label="关闭控制面板" onClick={closePanel} />}

      {activePanel === "gesture" && <section className={`${styles.quickMenu} ${styles.gestureMenu}`} aria-label="手势延迟拍照"><p>手势延迟拍照</p><div>{DELAY_OPTIONS.map((value) => <button key={String(value)} className={gestureDelay === value ? styles.quickSelected : ""} type="button" aria-pressed={gestureDelay === value} onClick={() => void selectGestureDelay(value)}>{value ? `${value}s` : "Off"}</button>)}</div></section>}
      {activePanel === "flash" && <section className={`${styles.quickMenu} ${styles.flashMenu}`} aria-label="闪光灯"><p>闪光灯</p><div>{(["off", "auto", "on"] as const).map((value) => <button key={value} className={flashMode === value ? styles.quickSelected : ""} type="button" aria-pressed={flashMode === value} onClick={() => selectFlash(value)}>{value === "off" ? "Off" : value === "auto" ? "Auto" : "On"}</button>)}</div></section>}

      {activePanel === "settings" && <section className={styles.settingsPanel} aria-label="设置">
        <i className={styles.sheetHandle} aria-hidden="true" />
        <div className={`${styles.settingsRow} ${styles.timerRow}`}><span><img src={`${ASSET}timer.svg`} alt="" />快门延时定时器(秒)</span><div className={styles.segmented}>{DELAY_OPTIONS.map((value) => <button key={String(value)} className={shutterDelay === value ? styles.segmentSelected : ""} type="button" aria-pressed={shutterDelay === value} onClick={() => void selectShutterDelay(value)}>{value ?? <span className={styles.offGlyph} aria-label="关闭" />}</button>)}</div></div>
        <div className={`${styles.settingsRow} ${styles.gridRow}`}><span><img src={`${ASSET}grid.svg`} alt="" />网格</span><button className={`${styles.switch} ${gridEnabled ? styles.switchOn : ""}`} type="button" role="switch" aria-checked={gridEnabled} onClick={() => void selectGrid(!gridEnabled)}><i /></button></div>
      </section>}

      {parameterPanelOpen && <section className={styles.parameterPanel} aria-label="参数调整">
        {activePanel === "iso" && <div className={styles.parameterWheelFrame}><div ref={isoWheelRef} className={styles.parameterWheel} role="listbox" aria-label="ISO" onScroll={handleISOWheelScroll} onWheel={translateVerticalWheel}>{ISO_OPTIONS.map((value, index) => <button key={String(value)} className={iso === value ? styles.parameterSelected : ""} type="button" role="option" aria-selected={iso === value} onClick={() => chooseISO(value, index)}>{value === "Auto" ? "Auto" : value}</button>)}</div><i className={styles.wheelIndicator} aria-hidden="true" /></div>}
        {activePanel === "ev" && <div className={styles.parameterWheelFrame}><div ref={evWheelRef} className={styles.parameterWheel} role="listbox" aria-label="曝光补偿" onScroll={handleEVWheelScroll} onWheel={translateVerticalWheel}>{EV_OPTIONS.map((value, index) => <button key={value} className={ev === value ? styles.parameterSelected : ""} type="button" role="option" aria-selected={ev === value} aria-label={`EV ${formatEV(value)}`} onClick={() => chooseEV(value, index)}>{formatEV(value)}</button>)}</div><i className={styles.wheelIndicator} aria-hidden="true" /></div>}
        {activePanel === "wb" && <div className={styles.wbOptions} role="listbox" aria-label="白平衡">{WB_OPTIONS.map((value) => <button key={value} className={whiteBalance === value ? styles.wbSelected : ""} type="button" role="option" aria-selected={whiteBalance === value} aria-label={value} title={value} onClick={() => void selectWhiteBalance(value)}><WhiteBalanceGlyph value={value} kelvin={kelvin} /></button>)}</div>}
        {activePanel === "kelvin" && <div className={styles.kelvinPanel}><button type="button" aria-label="返回白平衡" onClick={() => setActivePanel("wb")}>‹</button><output>{kelvin}K</output><input type="range" min="2500" max="10000" step="100" value={kelvin} aria-label="色温" onChange={(event) => setKelvin(Number(event.currentTarget.value))} onPointerUp={(event) => void commitKelvin(Number(event.currentTarget.value))} onKeyUp={(event) => void commitKelvin(Number(event.currentTarget.value))} /></div>}
        {activePanel === "filter" && <><p className={styles.filterName}>{FILTER_LABELS[filter]}</p><div className={styles.filterOptions} role="listbox" aria-label="滤镜">{FILTER_OPTIONS.map((value, index) => <button key={value} className={filter === value ? styles.filterSelected : ""} type="button" role="option" aria-selected={filter === value} aria-label={FILTER_LABELS[value]} title={FILTER_LABELS[value]} onClick={() => void selectFilter(value)}><img src={`${ASSET}filter-${index + 1}.png`} alt="" /></button>)}</div></>}
      </section>}

      <p className={styles.visuallyHidden} aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  );
}
