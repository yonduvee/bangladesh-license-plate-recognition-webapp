
from pathlib import Path

import cv2
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
IMAGE_PATH = BACKEND_DIR / "test_images" / "4-Figure10-1.png"
LOCALIZATION_MODEL = BASE_DIR / "models" / "localization" / "localization_best.pt"
CHARACTER_MODEL = BASE_DIR / "models" / "character" / "character_best.pt"
OUTPUT_DIR = BACKEND_DIR / "test_outputs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

image = cv2.imread(str(IMAGE_PATH))

if image is None:
    raise FileNotFoundError(f"Unable to read image: {IMAGE_PATH}")

localization_model = YOLO(str(LOCALIZATION_MODEL))
character_model = YOLO(str(CHARACTER_MODEL))

print(f"Input image: {IMAGE_PATH.name}")
print("Running license plate localization...")

localization_result = localization_model.predict(
    source=image,
    conf=0.25,
    imgsz=640,
    verbose=False
)[0]

cv2.imwrite(
    str(OUTPUT_DIR / "localization_result.jpg"),
    localization_result.plot()
)

if localization_result.boxes is None or len(localization_result.boxes) == 0:
    print("No license plate detected.")
    raise SystemExit(0)

boxes = localization_result.boxes.xyxy.cpu().numpy()
scores = localization_result.boxes.conf.cpu().numpy()

print(f"Detected plates: {len(boxes)}")

image_height, image_width = image.shape[:2]

for index, (box, score) in enumerate(zip(boxes, scores), start=1):
    x1, y1, x2, y2 = map(int, box)

    box_width = x2 - x1
    box_height = y2 - y1

    x1 = max(0, x1 - int(box_width * 0.05))
    x2 = min(image_width, x2 + int(box_width * 0.35))
    y1 = max(0, y1 - int(box_height * 0.15))
    y2 = min(image_height, y2 + int(box_height * 0.15))

    plate_crop = image[y1:y2, x1:x2]

    if plate_crop.size == 0:
        print(f"Plate {index}: invalid crop")
        continue

    crop_path = OUTPUT_DIR / f"plate_crop_{index}.jpg"
    cv2.imwrite(str(crop_path), plate_crop)

    print(f"\nPlate {index} localization confidence: {score:.4f}")
    print(f"Expanded crop size: {plate_crop.shape[1]}x{plate_crop.shape[0]}")
    print("Running character detection...")

    character_result = character_model.predict(
        source=plate_crop,
        conf=0.15,
        imgsz=640,
        verbose=False
    )[0]

    annotated_path = OUTPUT_DIR / f"characters_{index}.jpg"
    cv2.imwrite(str(annotated_path), character_result.plot())

    if character_result.boxes is None or len(character_result.boxes) == 0:
        print("No characters detected.")
        continue

    detections = []

    for char_box, char_score, class_id in zip(
        character_result.boxes.xyxy.cpu().numpy(),
        character_result.boxes.conf.cpu().numpy(),
        character_result.boxes.cls.cpu().numpy()
    ):
        char_x1, char_y1, char_x2, char_y2 = map(int, char_box)
        label = character_result.names[int(class_id)]

        detections.append(
            (char_y1, char_x1, label, float(char_score))
        )

    detections.sort(key=lambda item: (item[0], item[1]))

    for char_y, char_x, label, confidence in detections:
        print(
            f"Label: {label}, "
            f"Confidence: {confidence:.4f}, "
            f"Position: ({char_x}, {char_y})"
        )

print(f"\nTest images saved to: {OUTPUT_DIR}")
