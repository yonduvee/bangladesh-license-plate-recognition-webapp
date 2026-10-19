from pathlib import Path
import os
import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent
LOCALIZATION_PATH = BASE_DIR / "models" / "localization" / "localization_best.pt"
CHARACTER_PATH = BASE_DIR / "models" / "character" / "character_best.pt"
MAX_IMAGE_SIZE = 10 * 1024 * 1024

BANGLA_LABELS = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
    "ba": "ব", "ca": "চ", "chattogram": "চট্টগ্রাম", "da": "দ",
    "dhaka": "ঢাকা", "ga": "গ", "gha": "ঘ", "ha": "হ",
    "ja": "জ", "jashore": "যশোর", "ka": "ক", "kha": "খ",
    "khulna": "খুলনা", "metro": "মেট্রো", "na": "ন",
    "ta": "ট", "va": "ভ",
}

app = FastAPI(
    title="BD PlateVision API",
    description="Bangladesh License Plate Recognition Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

if not LOCALIZATION_PATH.exists():
    raise FileNotFoundError(f"Localization model not found: {LOCALIZATION_PATH}")
if not CHARACTER_PATH.exists():
    raise FileNotFoundError(f"Character model not found: {CHARACTER_PATH}")

localization_model = YOLO(str(LOCALIZATION_PATH))
character_model = YOLO(str(CHARACTER_PATH))


def assign_rows(detections, crop_height):
    if len(detections) < 2:
        for item in detections:
            item["row"] = "top"
        return detections

    by_y = sorted(detections, key=lambda item: item["center_y"])
    gaps = [
        (by_y[i + 1]["center_y"] - by_y[i]["center_y"], i)
        for i in range(len(by_y) - 1)
    ]
    largest_gap, split_index = max(gaps, key=lambda item: item[0])

    if largest_gap >= max(8.0, crop_height * 0.10):
        split_y = (
            by_y[split_index]["center_y"]
            + by_y[split_index + 1]["center_y"]
        ) / 2
    else:
        split_y = crop_height * 0.55

    for item in detections:
        item["row"] = "top" if item["center_y"] < split_y else "bottom"

    return detections


def recognize_characters(plate_crop):
    result = character_model.predict(
        source=plate_crop,
        conf=0.15,
        iou=0.7,
        imgsz=640,
        agnostic_nms=True,
        verbose=True,
    )[0]

    if result.boxes is None or len(result.boxes) == 0:
        return [], "", ""

    detections = []
    crop_height = plate_crop.shape[0]

    for box, confidence, class_id in zip(
        result.boxes.xyxy.cpu().numpy(),
        result.boxes.conf.cpu().numpy(),
        result.boxes.cls.cpu().numpy(),
    ):
        x1, y1, x2, y2 = map(float, box)
        label = result.names[int(class_id)]
        detections.append({
            "label": label,
            "character": BANGLA_LABELS.get(label, label),
            "confidence": round(float(confidence), 4),
            "x": int(round(x1)),
            "y": int(round(y1)),
            "center_x": (x1 + x2) / 2,
            "center_y": (y1 + y2) / 2,
        })

    detections = assign_rows(detections, crop_height)
    detections.sort(key=lambda item: (item["row"] != "top", item["x"]))

    top_labels = [item["label"] for item in detections if item["row"] == "top"]
    bottom_labels = [item["label"] for item in detections if item["row"] == "bottom"]

    top_texts = [BANGLA_LABELS.get(label, label) for label in top_labels]
    if "metro" in top_labels:
        metro_index = top_labels.index("metro")
        prefix = " ".join(top_texts[:metro_index + 1])
        suffix = "".join(top_texts[metro_index + 1:])
        top_line = f"{prefix}-{suffix}" if suffix else prefix
    else:
        top_line = " ".join(top_texts)

    bottom_texts = [BANGLA_LABELS.get(label, label) for label in bottom_labels]
    if len(bottom_texts) >= 5 and all(label.isdigit() for label in bottom_labels):
        bottom_line = "".join(bottom_texts[:2]) + "-" + "".join(bottom_texts[2:])
    else:
        bottom_line = "".join(bottom_texts)

    public_detections = [
        {
            "label": item["label"],
            "character": item["character"],
            "confidence": item["confidence"],
            "x": item["x"],
            "y": item["y"],
            "row": item["row"],
        }
        for item in detections
    ]

    return public_detections, top_line, bottom_line


@app.get("/")
def home():
    return {
        "application": "BD PlateVision",
        "message": "Bangladesh License Plate Recognition API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True,
        "localization_classes": localization_model.names,
        "character_classes": character_model.names,
    }


@app.post("/api/recognize")
async def recognize(file: UploadFile = File(...)):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, and WebP images are supported.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image size must be 10 MB or less.",
        )

    image_array = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )

    image_height, image_width = image.shape[:2]
    localization_result = localization_model.predict(
        source=image,
        conf=0.25,
        iou=0.5,
        imgsz=640,
        verbose=True,
    )[0]

    if localization_result.boxes is None or len(localization_result.boxes) == 0:
        return {
            "status": "not_detected",
            "filename": file.filename,
            "file_size": len(contents),
            "model_loaded": True,
            "message": "No license plate was detected in this image.",
            "detected_plates": [],
        }

    detected_plates = []
    for box, confidence in zip(
        localization_result.boxes.xyxy.cpu().numpy(),
        localization_result.boxes.conf.cpu().numpy(),
    ):
        x1, y1, x2, y2 = map(int, box)
        box_width = x2 - x1
        box_height = y2 - y1

        crop_x1 = max(0, x1 - int(box_width * 0.05))
        crop_x2 = min(image_width, x2 + int(box_width * 0.50))
        crop_y1 = max(0, y1 - int(box_height * 0.15))
        crop_y2 = min(image_height, y2 + int(box_height * 0.15))

        plate_crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
        if plate_crop.size == 0:
            continue

        character_detections, top_line, bottom_line = recognize_characters(plate_crop)
        recognized_text = " ".join(
            part for part in [top_line, bottom_line] if part
        )

        detected_plates.append({
            "plate_confidence": round(float(confidence), 4),
            "plate_bbox": [x1, y1, x2, y2],
            "recognized_text": recognized_text,
            "top_line": top_line,
            "bottom_line": bottom_line,
            "character_detections": character_detections,
        })

    return {
        "status": "success" if detected_plates else "not_detected",
        "filename": file.filename,
        "file_size": len(contents),
        "model_loaded": True,
        "message": (
            "License plate detection and character recognition completed."
            if detected_plates
            else "No valid license plate crop could be processed."
        ),
        "detected_plates": detected_plates,
    }
