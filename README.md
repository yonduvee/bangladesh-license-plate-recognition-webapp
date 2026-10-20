# Bangladesh License Plate Recognition

**A YOLO11-Based End-to-End Framework for Bangladeshi License Plate Localization and Character Recognition**

An image-based web application that detects Bangladeshi vehicle license plates and recognizes the Bangla text printed on them. The system combines a plate-localization model with a character-detection model and reconstructs the detected characters into a readable registration number.

> **Note:** Prediction may take some time, particularly on CPU-based hosting or during the first request while the models and runtime are being initialized. The application processes the uploaded image through multiple inference steps before returning the result.

## Features

- Upload a vehicle image for license-plate recognition.
- Detect and localize a license plate in the image.
- Recognize Bangla plate text using a separate character-detection model.
- Arrange detected characters spatially and reconstruct the plate into top and bottom lines when applicable.
- Display the recognized registration text and detection confidence information returned by the API.
- Open a Google Drive folder containing sample images for testing.
- Image-based inference only; video processing is intentionally not included.

## How It Works

1. **Image upload:** The user selects an image in the web interface.
2. **Plate localization:** A YOLO11 model locates the license plate in the image.
3. **Plate-region processing:** The detected plate region is prepared for character recognition.
4. **Character detection:** A second YOLO11 model detects the characters and plate components within the cropped region.
5. **Text reconstruction:** Detected elements are ordered by their spatial positions, separated into rows where appropriate, and reconstructed into the final Bangla registration text.
6. **Result display:** The API returns the recognition result and related detection details to the frontend.

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- CSS Modules / application styling

### Backend and Machine Learning

- Python
- FastAPI
- Uvicorn
- Ultralytics YOLO11
- PyTorch
- OpenCV
- NumPy
- Pillow
- `python-multipart` for image uploads

The frontend and Python inference API are separate application components. Configure the frontend to use the correct API base URL for the environment in which the backend is running.

## Models

The application uses two separately trained model weights:

| Model | File | Purpose |
|---|---|---|
| License plate localization | `models/localization/localization_best.pt` | Detects the license plate region in a vehicle image. |
| Character recognition | `models/character/character_best.pt` | Detects Bangla plate characters and related plate components. |

Both model files must be available at the paths expected by the backend. If the backend is deployed separately, place the weights in its configured model directory or update the paths in the backend configuration.

## Dataset Overview

The project uses two prepared datasets: one for license-plate localization and another for character detection.

### License Plate Localization

| Split | Images |
|---|---:|
| Training | 5,124 |
| Validation | 640 |
| Test | 641 |
| **Total** | **6,405** |

The dataset audit identified 4,660 positive images and 1,745 negative images, with 4,733 annotated plate objects. Annotation checks were performed to address image-dimension mismatches and invalid bounding boxes. The final localization dataset had no exact cross-split duplicate images detected by the audit.

### Character Detection

| Split | Images |
|---|---:|
| Training | 3,480 |
| Validation | 363 |
| Test | 218 |
| **Total** | **4,061** |

The character dataset contains 27 classes and approximately 35,705 annotated objects. The dataset was checked for invalid bounding boxes and cross-split leakage; the final split audit reported zero detected leakage cases.

## Model Evaluation

The project evaluation recorded the following held-out results:

| Task | mAP@50 | mAP@50–95 |
|---|---:|---:|
| License plate localization | 0.993 | 0.792 |
| Character detection | 0.944 | 0.708 |

These metrics describe model detection performance on the evaluated dataset. They do not guarantee that every real-world image will be transcribed correctly. Recognition quality depends on image clarity, plate size, lighting, viewing angle, occlusion, and whether the plate format is represented in the training data.

## Sample Images

Use the sample-image folder to test the application:

**[Open Sample Images on Google Drive](https://drive.google.com/drive/folders/1Iq5w2R6RoajZgF5obn0UBd1vVLxbT6RT?usp=drive_link)**

Choose a clear image containing a visible Bangladeshi license plate. Results may vary with image quality and camera angle.

## Requirements

- Python 3.12 is recommended for the inference backend.
- Node.js and npm compatible with the installed Next.js version.
- The trained model weight files listed above.
- Sufficient memory and CPU/GPU resources to load and run both models.

The backend and frontend have separate dependencies. Install and run them from their respective project directories.

## Run the Backend

The backend uses FastAPI and Uvicorn. From the backend directory, create and activate a virtual environment, then install the packages used by the project.

### Windows PowerShell

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi uvicorn python-multipart ultralytics opencv-python numpy pillow
```

Install the PyTorch build appropriate for your environment by following the official PyTorch installation selector: https://pytorch.org/get-started/locally/ . If the project already has a dependency file, prefer installing from that file so the environment matches the tested setup.

Start the API using the FastAPI application object in `main.py`:

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

This command assumes that `main.py` exposes a FastAPI instance named `app`. If the application object uses a different name or module path, adjust the command to match the backend code. Keep the backend running while using the frontend.

## Run the Frontend

From the Next.js frontend directory (the directory containing `package.json`):

```powershell
npm install
npm run dev
```

Open the local address printed by Next.js in the terminal, commonly `http://localhost:3000`.

Make sure the frontend's API configuration points to the backend address. For local development, the backend commonly runs at `http://localhost:8000`; use the actual API URL and environment-variable name defined in the frontend code. For production, configure the deployed backend URL and enable appropriate CORS settings on the backend.

## Using the Web App

1. Start the backend API.
2. Start the Next.js frontend.
3. Open the frontend in your browser.
4. Upload an image containing a Bangladeshi vehicle license plate, or open the sample-image folder and choose an example.
5. Start prediction and wait for the inference pipeline to finish.
6. Review the recognized Bangla text and any confidence or detection details shown by the interface.

## Understanding Prediction Time

Prediction involves more than a single operation. The application must load or access the trained models, localize the plate, process the plate crop, detect characters, and reconstruct the text. On CPU-based servers, these inference steps can take noticeable time. The first request can also be slower because the runtime may be initializing.

For the current project, the priority is to keep the working prediction pipeline stable rather than introduce extra hosting costs solely to reduce latency. Please wait for the result after submitting an image and avoid submitting the same image repeatedly while a prediction is in progress.

## Limitations

- The application currently accepts images; video processing is not supported.
- Low-resolution, blurry, tilted, poorly lit, or partially obscured plates may produce incorrect or incomplete text.
- Similar-looking characters can be confused, especially when the plate occupies only a small area of the image.
- Detection confidence is not a guarantee that the complete registration number is correct.
- Performance on unusual plate formats or conditions not represented in the dataset may differ from the reported evaluation metrics.
- Prediction speed depends on the hardware, server load, image dimensions, and model initialization state.

## Repository Structure

The following is a high-level view of the key application files. Exact backend folder names may differ depending on how the frontend and API are organized in the local or deployment setup.

```text
Bangladesh-License-Plate-Recognition/
├── models/
│   ├── localization/
│   │   └── localization_best.pt
│   └── character/
│       └── character_best.pt
├── src/
│   └── app/
│       ├── globals.css
│       ├── layout.tsx
│       ├── page.module.css
│       └── page.tsx
├── public/
├── package.json
└── README.md
```

The Python inference backend contains the FastAPI application (previously developed around `main.py`) and its own Python environment/dependencies. Keep large model files and local virtual environments out of source control when repository size or deployment limits require it; provide the model files through the project's chosen storage or deployment process instead.

## Responsible Use

This project is intended for learning, research, and demonstration of Bangladeshi license-plate localization and character recognition. Do not treat model output as authoritative legal or identity evidence. Verify the recognized registration number against the original image before using it for any consequential purpose.

## Author

**Abidul Hoque Alvee**

## Project Title

*A YOLO11-Based End-to-End Framework for Bangladeshi License Plate Localization and Character Recognition*
