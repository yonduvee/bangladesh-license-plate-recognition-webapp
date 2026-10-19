
"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileImage,
  ImagePlus,
  Info,
  LayoutDashboard,
  Menu,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";

import { deleteHistory, getHistory, saveHistory } from "./history-db";
import type { ApiResult, HistoryRecord } from "./history-db";

type Page = "dashboard" | "recognition" | "history" | "about";

type DisplayHistory = HistoryRecord & { imageUrl: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "recognition", label: "Plate Recognition", icon: ScanLine },
  { id: "history", label: "History", icon: Clock3 },
  { id: "about", label: "About Project", icon: Info },
] as const;

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [image, setImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [historyRecords, setHistoryRecords] = useState<DisplayHistory[]>([]);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  useEffect(() => {
    if (page !== "history") return;
    let cancelled = false;
    let urls: string[] = [];
    getHistory()
      .then((records) => {
        if (cancelled) return;
        const entries = records.map((record) => ({
          ...record,
          imageUrl: URL.createObjectURL(record.image),
        }));
        urls = entries.map((entry) => entry.imageUrl);
        setHistoryRecords(entries);
        setHistoryError("");
      })
      .catch(() => {
        if (!cancelled) setHistoryError("Unable to load browser history. Check browser storage permissions.");
      });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [page, historyRefresh]);

  const removeHistoryRecord = async (id: string) => {
    if (!window.confirm("Delete this saved detection from this browser?")) return;
    try {
      await deleteHistory(id);
      setExpandedHistory(null);
      setHistoryRefresh((value) => value + 1);
    } catch {
      setHistoryError("Could not delete the record. Please try again.");
    }
  };

  const firstPlate = apiResult?.detected_plates?.[0] ?? null;
  const previewWidth =
    imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0
      ? Math.min(480, (290 * imageDimensions.width) / imageDimensions.height)
      : null;

  const uploadImage = (file?: File) => {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please select a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be 10 MB or less.");
      return;
    }

    setError("");
    setApiResult(null);
    setCopied(false);
    setImageDimensions(null);
    setSelectedFile(file);
    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
      }
    };

    reader.onerror = () => {
      setError("Unable to read this image.");
      setSelectedFile(null);
    };

    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setSelectedFile(null);
    setFileName("");
    setImageDimensions(null);
    setError("");
    setApiResult(null);
    setCopied(false);

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  };

  const handleRecognize = async () => {
    if (!selectedFile || loading) return;

    setLoading(true);
    setError("");
    setApiResult(null);
    setCopied(false);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post<ApiResult>(
        `${API_URL}/api/recognize`,
        formData
      );

      setApiResult(response.data);
      if (response.data.status === "success" && response.data.detected_plates.length > 0) {
        try {
          await saveHistory(selectedFile, response.data);
        } catch {
          setHistoryError("Recognition worked, but the browser could not save this image to history.");
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError<{ detail?: string }>(err)) {
        setError(
          err.response?.data?.detail ||
            "Unable to connect to the backend. Make sure FastAPI is running."
        );
      } else {
        setError("An unexpected error occurred during recognition.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyPlate = async () => {
    if (!firstPlate?.recognized_text) return;

    try {
      await navigator.clipboard.writeText(firstPlate.recognized_text);
      setCopied(true);
    } catch {
      setError("Unable to copy the recognized plate.");
    }
  };

  const changePage = (value: Page) => {
    setPage(value);
    setSidebarOpen(false);
  };

  const uploadArea = (
    <div className="panel upload-panel">
      <div className="panel-heading">
        <div>
          <h2>Vehicle Image</h2>
          <p>Upload an image to detect and recognize its license plate.</p>
        </div>
        <span className="small-tag">JPG, PNG, WebP</span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => uploadImage(event.target.files?.[0])}
      />

      {image ? (
        <div
          className="image-preview"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            height: 290,
          }}
        >
          <div
            className="image-stage"
            style={{
              position: "relative",
              display: "inline-block",
              flex: "0 1 auto",
              width: previewWidth ? `${previewWidth}px` : "fit-content",
              aspectRatio:
                imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0
                  ? `${imageDimensions.width} / ${imageDimensions.height}`
                  : undefined,
              maxWidth: "100%",
              lineHeight: 0,
            }}
          >
            <img
              src={image}
              alt="Uploaded vehicle"
              style={{
                position: "static",
                display: "block",
                width: imageDimensions ? "100%" : "auto",
                height: imageDimensions ? "100%" : "auto",
                maxWidth: "100%",
                maxHeight: imageDimensions ? "100%" : 290,
                objectFit: "contain",
              }}
              onLoad={(event) => {
                setImageDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />

            {firstPlate &&
              imageDimensions &&
              firstPlate.plate_bbox.length === 4 &&
              imageDimensions.width > 0 &&
              imageDimensions.height > 0 && (
                <div
                  className="plate-box"
                  style={{
                    position: "absolute",
                    display: "block",
                    zIndex: 20,
                    boxSizing: "border-box",
                    border: "3px solid #48a1ff",
                    background: "rgba(61, 131, 255, 0.15)",
                    pointerEvents: "none",
                    left: `${(firstPlate.plate_bbox[0] / imageDimensions.width) * 100}%`,
                    top: `${(firstPlate.plate_bbox[1] / imageDimensions.height) * 100}%`,
                    width: `${((firstPlate.plate_bbox[2] - firstPlate.plate_bbox[0]) / imageDimensions.width) * 100}%`,
                    height: `${((firstPlate.plate_bbox[3] - firstPlate.plate_bbox[1]) / imageDimensions.height) * 100}%`,
                  }}
                >
                  <span
                    className="plate-label"
                    style={{
                      position: "absolute",
                      display: "block",
                      zIndex: 21,
                      top: -25,
                      left: -3,
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: "#397ef3",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Plate {(firstPlate.plate_confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
          </div>

          <button
            className="remove-image"
            onClick={removeImage}
            aria-label="Remove image"
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            uploadImage(event.dataTransfer.files[0]);
          }}
        >
          <div className="upload-icon">
            <UploadCloud size={30} />
          </div>
          <h3>Drop your vehicle image here</h3>
          <p>or choose an image from your device</p>
          <button
            className="secondary-button"
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={17} />
            Browse Files
          </button>
          <span className="upload-hint">Maximum file size: 10 MB</span>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {image && (
        <div className="selected-file">
          <FileImage size={18} />
          <span>{fileName}</span>
          <CheckCircle2 size={17} className="success-icon" />
        </div>
      )}

      <button
        className="primary-button recognize-button"
        disabled={!selectedFile || loading}
        onClick={handleRecognize}
      >
        <ScanLine size={19} />
        {loading ? "Analyzing Image..." : "Recognize License Plate"}
        <ArrowRight size={18} />
      </button>
      <div className="processing-notice" role="status" aria-live="polite">
        <Info size={17} />
        <p>
          {loading
            ? "Analyzing your image. This may take 1–2 minutes. Please keep this page open."
            : "Recognition may take 1–2 minutes due to limited computing resources on our free cloud server."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-logo">
            <ScanLine size={24} />
          </div>
          <div>
            <h2>BD PlateVision</h2>
            <span>AI Recognition System</span>
          </div>
        </div>

        <div className="navigation-label">WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => changePage(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="model-card">
            <div className="model-icon">
              <Activity size={20} />
            </div>
            <h3>YOLO11 Framework</h3>
            <p>
              Bangladeshi license plate localization and character recognition.
            </p>
            <span className="model-status">
              <span className="status-dot" />
              {apiResult?.model_loaded
                ? "Models Loaded"
                : "Awaiting Recognition"}
            </span>
          </div>

          <div className="sidebar-footer">
            <ShieldCheck size={16} />
            <span>Research Project · 2026</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">
              {navigation.find((item) => item.id === page)?.label}
            </span>
          </div>

          <div className="topbar-right">
            <span className="system-badge">
              <span className="status-dot" />
              {apiResult?.model_loaded ? "AI Models Loaded" : "System Ready"}
            </span>
            <div className="avatar">AH</div>
          </div>
        </header>

        <div className="content-container">
          {(page === "dashboard" || page === "recognition") && (
            <>
              <div className="page-intro">
                <span className="eyebrow">COMPUTER VISION PLATFORM</span>
                <h1>
                  {page === "dashboard"
                    ? "License Plate Recognition"
                    : "Plate Recognition"}
                </h1>
                <p>
                  AI-powered Bangladeshi vehicle license plate localization
                  and Bengali character recognition using YOLO11.
                </p>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">
                    <ScanLine size={22} />
                  </div>
                  <span>Detection Model</span>
                  <strong>YOLO11</strong>
                  <small>Plate localization</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon purple">
                    <Activity size={22} />
                  </div>
                  <span>Recognition Model</span>
                  <strong>YOLO11</strong>
                  <small>Character detection</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">
                    <CheckCircle2 size={22} />
                  </div>
                  <span>Latest Result</span>
                  <strong>
                    {!apiResult
                      ? "Ready"
                      : firstPlate
                        ? "Detected"
                        : "Not Found"}
                  </strong>
                  <small>
                    {!apiResult
                      ? "Upload an image to begin"
                      : firstPlate
                        ? `${apiResult.detected_plates.length} plate(s) detected`
                        : "No plate detected"}
                  </small>
                </div>
              </div>

              <div className="workspace-grid">
                {uploadArea}

                <div className="panel results-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recognition Results</h2>
                      <p>
                        {firstPlate
                          ? "AI prediction received from both trained models."
                          : "Detected plate information will appear here."}
                      </p>
                    </div>
                    <span className="pending-tag">
                      {!apiResult
                        ? "Pending"
                        : firstPlate
                          ? "Detected"
                          : "Not Found"}
                    </span>
                  </div>

                  <div className="empty-results">
                    <div className="result-placeholder">
                      {firstPlate ? (
                        <CheckCircle2 size={36} />
                      ) : (
                        <ScanLine size={36} />
                      )}
                    </div>

                    <h3>
                      {!apiResult
                        ? "No results yet"
                        : firstPlate
                          ? "License plate recognized"
                          : "No license plate detected"}
                    </h3>

                    <p>
                      {apiResult
                        ? apiResult.message
                        : "Upload a vehicle image to run the trained YOLO11 models."}
                    </p>

                    {firstPlate && (
                      <>
                        <div className="recognized-plate">
                          {firstPlate.recognized_text}
                        </div>
                        <button
                          className="secondary-button"
                          onClick={copyPlate}
                        >
                          <Copy size={16} />
                          {copied ? "Copied" : "Copy Plate Number"}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="result-details">
                    <div className="detail-row">
                      <span>Uploaded File</span>
                      <span className="detail-value">
                        {apiResult?.filename ?? "—"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>Image Size</span>
                      <span className="detail-value">
                        {apiResult
                          ? `${(apiResult.file_size / 1024).toFixed(2)} KB`
                          : "—"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>Recognized Plate</span>
                      <span className="detail-value">
                        {firstPlate?.recognized_text ?? "—"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>Plate Confidence</span>
                      <span className="detail-value">
                        {firstPlate
                          ? `${(firstPlate.plate_confidence * 100).toFixed(2)}%`
                          : "—"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>Upper Line</span>
                      <span className="detail-value">
                        {firstPlate?.top_line ?? "—"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>Lower Line</span>
                      <span className="detail-value">
                        {firstPlate?.bottom_line ?? "—"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>Model Status</span>
                      <span className="detail-value">
                        {apiResult?.model_loaded ? "Loaded" : "Not tested"}
                      </span>
                    </div>
                  </div>

                  {firstPlate && (
                    <div className="result-details">
                      <div className="detail-row">
                        <span>
                          <strong>Character</strong>
                        </span>
                        <span className="detail-value">
                          <strong>Confidence</strong>
                        </span>
                      </div>

                      {firstPlate.character_detections.map((item, index) => (
                        <div
                          className="detail-row"
                          key={`${item.row}-${item.x}-${item.label}-${index}`}
                        >
                          <span>
                            {item.character}{" "}
                            <span className="character-label">
                              ({item.label})
                            </span>
                          </span>
                          <span className="detail-value">
                            {(item.confidence * 100).toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="info-banner">
                <div className="info-banner-icon">
                  <Info size={21} />
                </div>
                <div>
                  <h3>AI Recognition Status</h3>
                  <p>
                    {firstPlate
                      ? "The detected plate is outlined on the uploaded image. Verify the prediction against the original plate, especially when localization confidence is low."
                      : "Upload a vehicle image to test the trained localization and character recognition models."}
                  </p>
                </div>
              </div>
            </>
          )}

          {page === "history" && (
            <div className="subpage">
              <div className="page-intro">
                <span className="eyebrow">ACTIVITY</span>
                <h1>Recognition History</h1>
                <p>Images and results are stored privately in this browser, not on a cloud database.</p>
              </div>
              {historyError && <p className="error-message">{historyError}</p>}
              <div className="panel standalone-panel">
                {historyRecords.length === 0 ? (
                  <div className="empty-results">
                    <div className="result-placeholder"><Clock3 size={36} /></div>
                    <h3>No saved history</h3>
                    <p>Successfully recognized plates will appear here automatically on this device.</p>
                    <button className="secondary-button" onClick={() => changePage("recognition")}>
                      Start Recognition <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="history-list">
                    {historyRecords.map((record) => {
                      const plate = record.result.detected_plates[0];
                      const expanded = expandedHistory === record.id;
                      return (
                        <article className="history-record" key={record.id}>
                          <div className="history-summary">
                            <img className="history-thumbnail" src={record.imageUrl} alt="Previously uploaded vehicle" />
                            <div className="history-meta">
                              <strong>{plate?.recognized_text || "Plate detected"}</strong>
                              <span>{new Date(record.createdAt).toLocaleString()}</span>
                              <span>{record.filename}</span>
                              <span>Confidence: {plate ? (plate.plate_confidence * 100).toFixed(2) : "—"}%</span>
                              <span>{record.result.detected_plates.length} plate(s)</span>
                            </div>
                            <div className="history-actions">
                              <button className="secondary-button" onClick={() => setExpandedHistory(expanded ? null : record.id)}>
                                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                {expanded ? "Hide" : "Details"}
                              </button>
                              <button className="secondary-button history-delete" onClick={() => void removeHistoryRecord(record.id)}>
                                <Trash2 size={16} /> Delete
                              </button>
                            </div>
                          </div>
                          {expanded && (
                            <div className="history-details">
                              <img className="history-full-image" src={record.imageUrl} alt="Full uploaded vehicle" />
                              {record.result.detected_plates.map((item, index) => (
                                <div key={index} className="history-plate-details">
                                  <h3>Plate {index + 1}: {item.recognized_text}</h3>
                                  <p>Upper line: {item.top_line || "—"}</p>
                                  <p>Lower line: {item.bottom_line || "—"}</p>
                                  <p>Localization confidence: {(item.plate_confidence * 100).toFixed(2)}%</p>
                                  <p>Bounding box: {item.plate_bbox.join(", ")}</p>
                                  <strong>Characters</strong>
                                  {item.character_detections.map((character, characterIndex) => (
                                    <p key={characterIndex}>{character.character} ({character.label}) — {(character.confidence * 100).toFixed(2)}% · {character.row}</p>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="history-privacy">History is saved only in this browser. Clearing site data or using another browser/device may remove or hide it.</p>
            </div>
          )}

          {page === "about" && (
            <div className="subpage">
              <div className="page-intro">
                <span className="eyebrow">RESEARCH & DEVELOPMENT</span>
                <h1>About the Project</h1>
                <p>Learn about the technology powering BD PlateVision.</p>
              </div>

              <div className="panel about-panel">
                <div className="about-icon">
                  <ScanLine size={30} />
                </div>

                <h2>
                  A YOLO11-Based End-to-End Framework for Bangladeshi License
                  Plate Localization and Character Recognition
                </h2>

                <p>
                  This project focuses on detecting Bangladeshi vehicle
                  license plates and recognizing Bengali characters using
                  deep learning and computer vision.
                </p>

                <div className="about-details">
                  <div>
                    <span>Developed By</span>
                    <strong>Abidul Hoque Alvee</strong>
                  </div>
                  <div>
                    <span>Framework</span>
                    <strong>YOLO11</strong>
                  </div>
                  <div>
                    <span>Frontend</span>
                    <strong>Next.js & TypeScript</strong>
                  </div>
                  <div>
                    <span>Backend</span>
                    <strong>FastAPI & PyTorch</strong>
                  </div>
                </div>

                <div className="about-footer">
                  <ScanLine size={18} />
                  <span>Independent Computer Vision Project</span>
                </div>
              </div>
            </div>
          )}

          <footer className="page-footer">
            <span>© 2026 BD PlateVision</span>
            <span>Developed by Abidul Hoque Alvee</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
