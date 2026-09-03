# Ayusync Medical Document Analysis API Documentation

## Overview

The **Ayusync Document Analysis API** is a high-performance, decoupled microservice designed to ingest medical documents (images and multi-page PDFs), extract text verbatim using Vision Language Models (VLM), and perform intelligent, domain-specific structuring using an agentic LLM workflow.

This service is designed to be consumed directly by external backends, mobile applications, web applications, or workflow orchestrators.

---

## Service Endpoints & Base URL

| Environment | Base URL | Interactive Docs (Swagger UI) | Alternative Docs (ReDoc) |
| :--- | :--- | :--- | :--- |
| **Local Development** | `http://localhost:8000` | [http://localhost:8000/docs](http://localhost:8000/docs) | [http://localhost:8000/redoc](http://localhost:8000/redoc) |
| **Network / LAN** | `http://<server-ip>:8000` | `http://<server-ip>:8000/docs` | `http://<server-ip>:8000/redoc` |

---

## Authentication & Headers

* **Current Status**: Open / No authentication (configured for private microservice networks).
* **Cross-Origin Resource Sharing (CORS)**: Enabled (`*`) for all origins, headers, and methods.

---

## API Specification

### Analyze Document

Extracts verbatim OCR text and parses structured medical entities from an uploaded image or PDF document.

* **URL**: `/api/analyze`
* **Method**: `POST`
* **Content-Type**: `multipart/form-data`

#### Request Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file` | `binary` | **Yes** | The document to analyze. Supported file formats: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`. |

#### Supported Document Types & Processing Pipelines

The service executes a **two-step pipeline**:

1. **OCR Extraction (Vision Model)**:
   * **PDFs**: Automatically converted into high-resolution images page-by-page (rendered at 2x scaling via PyMuPDF).
   * **Images**: Resized if needed (max 2048x2048) and base64-encoded.
   * Document type is categorized (e.g., `Prescription`, `Discharge Summary`, `Lab Report`, `Bill`).
   * Complete text is extracted verbatim across all pages.

2. **Agentic Structuring (LLM Step)**:
   Depending on the detected document classification, a specialized structuring pass is triggered:
   * **Prescriptions (`Rx`)**: Extracts a list of medications.
   * **Discharge Summaries**: Synthesizes a clinical summary and generates an actionable post-discharge care plan.
   * **Lab Reports / Invoices / Bills**: Extracts key metrics, values, and billing amounts into key-value pairs.

---

### Response Schemas

#### Success Response: `200 OK`

Content-Type: `application/json`

```json
{
  "document_type": "string",
  "extracted_text": "string",
  "medicines": ["string", "string"],
  "summary": "string | null",
  "care_plan": "string | null",
  "values": {
    "key": "value"
  }
}
```

#### Field Descriptions

| Field | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `document_type` | `string` | No | Detected document category (e.g. `Prescription`, `Discharge Summary`, `Lab Report`, `Medical Bill`, `Unknown`). |
| `extracted_text` | `string` | No | Complete, unedited verbatim text extracted from the document (multi-page documents include page markers: `--- Page X ---`). |
| `medicines` | `array[string]` | Yes | Populated for prescriptions. Array of extracted drug / medication names. |
| `summary` | `string` | Yes | Populated for discharge summaries. Concise summary of diagnosis, stay, and procedures. |
| `care_plan` | `string` | Yes | Populated for discharge summaries. Structured instructions for at-home recovery and medication routine. |
| `values` | `object` | Yes | Populated for lab reports and bills. Key-value mapping of detected medical parameters, test values, or charges. |

---

### Response Examples

#### Example 1: Prescription Document

```json
{
  "document_type": "Prescription",
  "extracted_text": "Dr. Sarah Smith, MD\nPatient: John Doe, Age: 45\nRx:\n1. Amoxicillin 500mg - 1 tablet three times daily for 7 days\n2. Ibuprofen 400mg - as needed for pain\nRefills: 0",
  "medicines": [
    "Amoxicillin 500mg",
    "Ibuprofen 400mg"
  ],
  "summary": null,
  "care_plan": null,
  "values": null
}
```

#### Example 2: Hospital Discharge Summary

```json
{
  "document_type": "Discharge Summary",
  "extracted_text": "City General Hospital\nDischarge Summary\nPatient was admitted for acute appendicitis. Laparoscopic appendectomy performed on 02/09/2026 without complications. Vitals stable upon discharge.",
  "medicines": null,
  "summary": "45-year-old patient underwent uneventful laparoscopic appendectomy for acute appendicitis. Discharged in stable condition.",
  "care_plan": "1. Keep incision site clean and dry.\n2. Avoid strenuous activity or lifting heavy weights for 2 weeks.\n3. Take prescribed pain relievers as directed.\n4. Attend follow-up appointment in 10 days.",
  "values": null
}
```

#### Example 3: Lab Test / Bill Report

```json
{
  "document_type": "Lab Report",
  "extracted_text": "Pathology Labs Inc.\nComplete Blood Count (CBC)\nHemoglobin: 14.2 g/dL (Ref: 13.8 - 17.2)\nWBC: 6,800 /uL (Ref: 4,500 - 11,000)\nPlatelets: 240,000 /uL (Ref: 150,000 - 450,000)",
  "medicines": null,
  "summary": null,
  "care_plan": null,
  "values": {
    "Hemoglobin": "14.2 g/dL",
    "WBC": "6,800 /uL",
    "Platelets": "240,000 /uL"
  }
}
```

---

### Error Responses

| Status Code | Description | Example Payload |
| :--- | :--- | :--- |
| **`422 Unprocessable Entity`** | The `file` parameter is missing or improperly formed. | `{"detail": [{"loc": ["body", "file"], "msg": "Field required", "type": "missing"}]}` |
| **`500 Internal Server Error`** | Processing failed (e.g. corrupt file, invalid image format, or LLM failure). | `{"detail": "Invalid image file: cannot identify image file"}` |

---

## Integration Code Examples

### 1. Python (`requests`)

```python
import requests

API_URL = "http://localhost:8000/api/analyze"
FILE_PATH = "sample_prescription.jpg"

def analyze_medical_document(file_path: str):
    with open(file_path, "rb") as document_file:
        files = {"file": (file_path, document_file, "image/jpeg")}
        response = requests.post(API_URL, files=files, timeout=60)
        
        response.raise_for_status()
        return response.json()

if __name__ == "__main__":
    result = analyze_medical_document(FILE_PATH)
    print("Detected Document:", result["document_type"])
    print("Extracted Text:\n", result["extracted_text"])
    
    if result.get("medicines"):
        print("Prescribed Medicines:", result["medicines"])
    if result.get("values"):
        print("Values:", result["values"])
```

---

### 2. Node.js / TypeScript (`fetch`)

```typescript
import fs from 'fs';
import path from 'path';

async function analyzeDocument(filePath: string) {
  const url = 'http://localhost:8000/api/analyze';
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([fileBuffer], { type: 'application/pdf' }),
    fileName
  );

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data;
}

// Example usage
analyzeDocument('./patient_discharge.pdf')
  .then((data) => console.log('Analysis Result:', data))
  .catch((err) => console.error(err));
```

---

### 3. cURL (Command Line)

```bash
# Analyze an image
curl -X POST "http://localhost:8000/api/analyze" \
  -H "Accept: application/json" \
  -F "file=@/path/to/prescription.jpg"

# Analyze a multi-page PDF
curl -X POST "http://localhost:8000/api/analyze" \
  -H "Accept: application/json" \
  -F "file=@/path/to/discharge_summary.pdf"
```

---

### 4. Go

```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

func analyzeDocument(url string, filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return "", err
	}
	_, err = io.Copy(part, file)
	if err != nil {
		return "", err
	}
	writer.Close()

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	return string(respBody), nil
}
```

---

## Deployment & Configuration

### Environment Variables

Configure these variables in [`backend/.env`](file:///c:/ocr-analysis/backend/.env):

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `GROQ_API_KEY` | **Yes** | None | API key obtained from [console.groq.com](https://console.groq.com) for high-speed inference. |

### Running the Server

To launch the backend API service:

```bash
# In c:/ocr-analysis/backend with activated venv:
uvicorn main:app --host 0.0.0.0 --port 8000
```

For production deployment with multiple workers:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Best Practices for Main Solution Integration

1. **Timeouts**: Medical PDFs with multiple pages can require several seconds for page-by-page vision OCR. We recommend a client timeout setting of **at least 30 to 60 seconds**.
2. **File Size & Page Limits**: For optimum latency, limit single PDF uploads to 10 pages or fewer at a time.
3. **Retry Strategy**: Implement exponential backoff for HTTP 500/503 responses to handle upstream LLM rate limits gracefully.
