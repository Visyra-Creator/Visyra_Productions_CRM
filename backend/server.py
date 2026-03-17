from fastapi import FastAPI, APIRouter, UploadFile, File, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import shutil
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from PIL import Image as PILImage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

if not os.getenv('MONGO_URL'):
    load_dotenv(ROOT_DIR / 'env')

# Setup Directories
STORAGE_DIR = ROOT_DIR / "storage"
UPLOAD_DIR = STORAGE_DIR / "originals"
THUMB_DIR = STORAGE_DIR / "thumbnails"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMB_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB connection
mongo_url = os.getenv('MONGO_URL')
if not mongo_url:
    mongo_url = "mongodb://localhost:27017" # Default for local dev

client = AsyncIOMotorClient(mongo_url)
db = client[os.getenv('DB_NAME', 'visyra_db')]

app = FastAPI()

# Mount storage to serve files
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

api_router = APIRouter(prefix="/api")

# --- Helper Functions ---

def generate_thumbnail(source_path: str, filename: str):
    """Generates a thumbnail in the background without touching the original file."""
    try:
        # Check if it's an image before processing
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            with PILImage.open(source_path) as img:
                img.thumbnail((400, 400))
                img.save(THUMB_DIR / f"thumb_{filename}", optimize=True, quality=85)
    except Exception as e:
        print(f"Thumbnail generation failed: {e}")

# --- API Endpoints ---

class StatusCheck(BaseModel):
    status: str
    timestamp: str

@api_router.get("/status", response_model=StatusCheck)
async def get_status():
    return StatusCheck(
        status="online",
        timestamp=datetime.now().isoformat()
    )

@api_router.post("/upload")
async def handle_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    logging.info(f"[upload] incoming filename={file.filename} content_type={file.content_type}")
    # Sanitize filename or use UUID to prevent overwrites
    ext = Path(file.filename).suffix
    unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}{ext}"
    file_path = UPLOAD_DIR / unique_filename

    # CRITICAL: Copy directly from the stream to prevent any library-side compression
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        file_size = file_path.stat().st_size
    except Exception:
        file_size = -1

    logging.info(f"[upload] saved unique_filename={unique_filename} extension={ext} size_bytes={file_size}")

    # Generate thumbnail in background for images
    background_tasks.add_task(generate_thumbnail, str(file_path), unique_filename)

    # Construct the URL to access the file
    # In production, replace 'localhost:8000' with your server domain
    file_url = f"/storage/originals/{unique_filename}"
    thumb_url = f"/storage/thumbnails/thumb_{unique_filename}"

    return {
        "status": "success",
        "url": file_url,
        "thumbnail_url": thumb_url if unique_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) else None,
        "filename": unique_filename,
        "original_name": file.filename
    }

app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
