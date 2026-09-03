# Ayusync - Medical OCR & Intelligent Document Analysis

Ayusync is a medical document processing platform providing high-accuracy OCR text extraction and automated structured data extraction (medicines, discharge care plans, lab values, and billing data).

## Architecture

- **`backend/`**: FastAPI service leveraging Groq Vision & Language models (`qwen/qwen3.8-27b` and `openai/gpt-oss-120b`) with PyMuPDF and Pillow for document processing.
- **`frontend/`**: Vite + React 19 + TypeScript modern dark-mode interface for testing, uploading, and camera-scanning documents.

## API Integration

If you are integrating this service with your main solution or another backend, see the complete API documentation:

👉 **[API Documentation](file:///c:/ocr-analysis/API_DOCUMENTATION.md)**

## Quick Start

### 1. Backend

```bash
cd backend
# Activate virtual environment
.\venv\Scripts\activate
# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000
```
Swagger UI documentation available at: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm.cmd run dev
```
Accessible at: `http://localhost:5173`
