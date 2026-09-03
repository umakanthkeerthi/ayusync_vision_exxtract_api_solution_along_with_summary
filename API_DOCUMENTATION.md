# Ayusync Medical Document Intelligence API
## Main Solution Integration Specification & Documentation

This document specifies the integration contract for connecting your **Main Solution** (backend, mobile app, or web application) to the **Ayusync Medical Document Analysis API** hosted live on AWS EC2.

---

## 1. Quick Reference & Endpoints

| Environment | Base URL | Endpoint URL | Interactive Swagger Docs | OpenAPI 3.1 Spec |
| :--- | :--- | :--- | :--- | :--- |
| **AWS EC2 (Production Live)** | `http://13.53.200.2` | `POST http://13.53.200.2/api/analyze` | [http://13.53.200.2/docs](http://13.53.200.2/docs) | [http://13.53.200.2/openapi.json](http://13.53.200.2/openapi.json) |
| **Local Development** | `http://localhost:8000` | `POST http://localhost:8000/api/analyze` | `http://localhost:8000/docs` | `http://localhost:8000/openapi.json` |

* **Port**: Runs on standard HTTP **Port 80** in production (managed by Nginx reverse proxy).
* **CORS**: Enabled (`*`) for all origins, headers, and HTTP methods.
* **Authentication**: Currently open for internal microservice communication.

---

## 2. Request Specification

### Endpoint: `POST /api/analyze`

Accepts a medical document (PDF or image), extracts verbatim text across all pages via high-resolution Vision models, and returns structured clinical data.

#### Headers
```http
Content-Type: multipart/form-data
Accept: application/json
```

#### Form-Data Body Parameters

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file` | `binary` | **Yes** | The document to analyze. Supported file extensions: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`. |

#### Ingestion Limits
* **Maximum File Size**: 25 MB (configured in Nginx `client_max_body_size`).
* **Multi-Page PDFs**: Automatically split, rendered at 2x scaling, and processed page-by-page. For optimal latency, PDFs under 10 pages are recommended.
* **Recommended Client Timeout**: **30 to 60 seconds** (multi-page vision inference may take 5–15 seconds depending on document length).

---

## 3. Response Specification

The API returns a JSON object adhering to the schema below.

### 3.1 Response JSON Schema Overview

```json
{
  "document_type": "string",
  "extracted_text": "string",
  "discharge_data": { ... } | null,
  "medicines": ["string"] | null,
  "summary": "string" | null,
  "care_plan": "string" | null,
  "values": { "key": "value" } | null
}
```

### 3.2 Field Definitions

| Field Name | Type | Nullable | Populated When | Description |
| :--- | :--- | :--- | :--- | :--- |
| `document_type` | `string` | No | Always | Detected category: `"Discharge Summary"`, `"Prescription"`, `"Lab Report"`, or `"Medical Bill"`. |
| `extracted_text` | `string` | No | Always | Complete, unedited verbatim OCR transcription of all document pages. |
| `discharge_data` | `object` | **Yes** | `document_type == "Discharge Summary"` | Standardized clinical object containing patient details, diagnoses, surgeries, medications, and recovery care plan. |
| `medicines` | `array[string]`| **Yes** | Prescriptions & Discharge Summaries | Array of medication names extracted from the document. |
| `summary` | `string` | **Yes** | Discharge Summaries | Concise narrative overview of diagnosis, hospital course, and discharge status. |
| `care_plan` | `string` | **Yes** | Discharge Summaries | Concise narrative overview of recovery instructions and precautions. |
| `values` | `object` | **Yes** | Lab Reports & Bills | Key-value dictionary of clinical test metrics (e.g. `{"Hemoglobin": "14.2 g/dL"}`) or billing amounts. |

---

## 4. Standardized `discharge_data` Schema

Whenever any hospital discharge summary, discharge card, inpatient summary, or post-operative summary is uploaded, `discharge_data` is populated with this exact schema:

```json
{
  "discharge_data": {
    "patient_info": {
      "name": "Patient full name or null",
      "age": "Patient age or null (e.g. '16' or '50 Years')",
      "gender": "Patient gender or null (e.g. 'Male' or 'M')",
      "hospital_name": "Hospital / Clinic name or null",
      "admission_date": "Admission date string or null",
      "discharge_date": "Discharge date string or null"
    },
    "diagnosis": "Primary clinical diagnosis string or null",
    "procedures": [
      "Array of surgeries or procedures performed with dates"
    ],
    "hospital_course": "Summary of treatment and clinical course during hospital stay",
    "condition_at_discharge": "Patient stability/status upon discharge (e.g. 'Hemodynamically stable')",
    "discharge_medications": [
      {
        "name": "Medicine name and strength",
        "dosage": "e.g. '1 tablet'",
        "frequency": "e.g. 'Twice daily (morning and night)'",
        "duration": "e.g. '7 days'",
        "instructions": "e.g. 'Take with food'"
      }
    ],
    "care_plan": {
      "activity_restrictions": [
        "Array of physical restrictions, brace usage, limb elevation instructions"
      ],
      "dietary_instructions": "Diet guidance string or null",
      "physiotherapy": [
        "Array of step-by-step physiotherapy milestones and exercises"
      ],
      "wound_care": "Dressing and surgical site hygiene guidance or null",
      "warning_signs": [
        "Array of red flags and symptoms requiring urgent medical attention"
      ],
      "emergency_contact": "Emergency phone number or contact advice or null"
    },
    "follow_up": {
      "date": "Review appointment date or null",
      "department_or_doctor": "Department or doctor name or null",
      "instructions": "Follow-up instructions (e.g. 'Suture removal and wound inspection')"
    }
  }
}
```

---

## 5. Copy-Paste Client Type Definitions for Your Main Solution

### TypeScript / JavaScript (Node.js, Next.js, NestJS, Express)

```typescript
export interface PatientInfo {
  name: string | null;
  age: string | null;
  gender: string | null;
  hospital_name: string | null;
  admission_date: string | null;
  discharge_date: string | null;
}

export interface DischargeMedicationItem {
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
}

export interface CarePlanDetails {
  activity_restrictions: string[] | null;
  dietary_instructions: string | null;
  physiotherapy: string[] | null;
  wound_care: string | null;
  warning_signs: string[] | null;
  emergency_contact: string | null;
}

export interface FollowUpDetails {
  date: string | null;
  department_or_doctor: string | null;
  instructions: string | null;
}

export interface DischargeSummaryDetails {
  patient_info: PatientInfo | null;
  diagnosis: string | null;
  procedures: string[] | null;
  hospital_course: string | null;
  condition_at_discharge: string | null;
  discharge_medications: DischargeMedicationItem[] | null;
  care_plan: CarePlanDetails | null;
  follow_up: FollowUpDetails | null;
}

export interface AyusyncOCRResponse {
  document_type: 'Discharge Summary' | 'Prescription' | 'Lab Report' | 'Medical Bill' | string;
  extracted_text: string;
  discharge_data: DischargeSummaryDetails | null;
  medicines: string[] | null;
  summary: string | null;
  care_plan: string | null;
  values: Record<string, string> | null;
}
```

### Python (Pydantic / FastAPI / Django)

```python
from typing import Optional, List, Dict
from pydantic import BaseModel

class PatientInfo(BaseModel):
    name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    hospital_name: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None

class DischargeMedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None

class CarePlanDetails(BaseModel):
    activity_restrictions: Optional[List[str]] = None
    dietary_instructions: Optional[str] = None
    physiotherapy: Optional[List[str]] = None
    wound_care: Optional[str] = None
    warning_signs: Optional[List[str]] = None
    emergency_contact: Optional[str] = None

class FollowUpDetails(BaseModel):
    date: Optional[str] = None
    department_or_doctor: Optional[str] = None
    instructions: Optional[str] = None

class DischargeSummaryDetails(BaseModel):
    patient_info: Optional[PatientInfo] = None
    diagnosis: Optional[str] = None
    procedures: Optional[List[str]] = None
    hospital_course: Optional[str] = None
    condition_at_discharge: Optional[str] = None
    discharge_medications: Optional[List[DischargeMedicationItem]] = None
    care_plan: Optional[CarePlanDetails] = None
    follow_up: Optional[FollowUpDetails] = None

class AyusyncOCRResponse(BaseModel):
    document_type: str
    extracted_text: str
    discharge_data: Optional[DischargeSummaryDetails] = None
    medicines: Optional[List[str]] = None
    summary: Optional[str] = None
    care_plan: Optional[str] = None
    values: Optional[Dict[str, str]] = None
```

---

## 6. Integration Code Examples for Your Main Solution

### 6.1 Node.js / TypeScript (`fetch`)

```typescript
import fs from 'fs';
import path from 'path';

const AYUSYNC_API_URL = process.env.AYUSYNC_API_URL || 'http://13.53.200.2/api/analyze';

export async function analyzeMedicalDocument(filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);

  const response = await fetch(AYUSYNC_API_URL, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60000), // 60s timeout
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ayusync API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data;
}

// Example usage:
// const result = await analyzeMedicalDocument('./patient_discharge.pdf');
// if (result.document_type === 'Discharge Summary') {
//   console.log('Patient Name:', result.discharge_data?.patient_info?.name);
//   console.log('Medications:', result.discharge_data?.discharge_medications);
// }
```

---

### 6.2 Python (`requests` / `httpx`)

```python
import requests

AYUSYNC_API_URL = "http://13.53.200.2/api/analyze"

def analyze_medical_document(file_path: str) -> dict:
    with open(file_path, "rb") as doc_file:
        files = {"file": (file_path, doc_file, "application/octet-stream")}
        response = requests.post(AYUSYNC_API_URL, files=files, timeout=60)
        
        response.raise_for_status()
        return response.json()

# Example usage:
if __name__ == "__main__":
    result = analyze_medical_document("discharge_summary.pdf")
    print("Detected Document Type:", result["document_type"])
    
    if result["document_type"] == "Discharge Summary" and result.get("discharge_data"):
        data = result["discharge_data"]
        print("Patient Name:", data.get("patient_info", {}).get("name"))
        print("Diagnosis:", data.get("diagnosis"))
        print("Medications:")
        for med in data.get("discharge_medications", []):
            print(f" - {med['name']}: {med.get('dosage')} {med.get('frequency')}")
```

---

### 6.3 cURL (Command Line)

```bash
# Upload and analyze document
curl -X POST "http://13.53.200.2/api/analyze" \
     -H "Accept: application/json" \
     -F "file=@/path/to/discharge_summary.pdf"
```

---

## 7. Sample API Responses

### 7.1 Discharge Summary Response (`discharge_data`)

```json
{
  "document_type": "Discharge Summary",
  "extracted_text": "AIMS General Hospital\nPatient Name: Mr. Palusa Sai Charan, Age: 16, Sex: Male...",
  "discharge_data": {
    "patient_info": {
      "name": "Mr. Palusa Sai Charan",
      "age": "16",
      "gender": "Male",
      "hospital_name": "AIMS General Hospital",
      "admission_date": "25 Apr 2023",
      "discharge_date": "05 May 2023"
    },
    "diagnosis": "Recurrent traumatic closed subluxation of the left patella",
    "procedures": [
      "Medial patellofemoral ligament reconstruction of the left knee with hamstring graft on 03 May 2023"
    ],
    "hospital_course": "Underwent MPFL reconstruction of left knee with hamstring graft on 3 May 2023. Post-operative dressing done on 5 May 2023. Discharged hemodynamically stable.",
    "condition_at_discharge": "Hemodynamically stable",
    "discharge_medications": [
      {
        "name": "Hifena C-P",
        "dosage": "1 tablet",
        "frequency": "Twice daily (morning and night)",
        "duration": "7 days",
        "instructions": "Take with food"
      },
      {
        "name": "Pan 40 mg",
        "dosage": "1 tablet",
        "frequency": "Once daily (morning)",
        "duration": "7 days",
        "instructions": "Take on empty stomach"
      },
      {
        "name": "Starox 50 mg",
        "dosage": "1 tablet",
        "frequency": "Twice daily",
        "duration": "5 days",
        "instructions": "Take after food"
      },
      {
        "name": "Vitamin C 500 mg",
        "dosage": "1 tablet",
        "frequency": "Once daily",
        "duration": "30 days",
        "instructions": "Take with food"
      }
    ],
    "care_plan": {
      "activity_restrictions": [
        "Limb elevation when seated or lying down",
        "Active toe movements every few hours",
        "Strict non-weight-bearing on left leg until cleared",
        "Wear long knee brace continuously for 6 weeks (remove only for hygiene)"
      ],
      "dietary_instructions": "Normal balanced diet with adequate protein and vitamin C to support healing",
      "physiotherapy": [
        "Weeks 1-2: Knee ROM 0-30°, gentle quadriceps sets and ankle pumps",
        "Weeks 3-4: Progress ROM to 30-60°, straight-leg raises and hamstring isometrics",
        "Weeks 5-6: Progress ROM to 60-90°, gentle closed-chain exercises",
        "Do not exceed 90° flexion until after week 6"
      ],
      "wound_care": "Keep dressing clean and dry. Maintain good hygiene of surgical site.",
      "warning_signs": [
        "Signs of wound infection, increased pain, or abnormal swelling",
        "Loss of sensation in toes or calf pain"
      ],
      "emergency_contact": "1066"
    },
    "follow_up": {
      "date": "18 May 2023",
      "department_or_doctor": "Orthopaedics OPD",
      "instructions": "Suture removal and wound inspection"
    }
  },
  "medicines": [
    "Hifena C-P",
    "Pan 40 mg",
    "Starox 50 mg",
    "Vitamin C 500 mg"
  ],
  "summary": "Mr. Palusa Sai Charan, 16-year-old male, was admitted to AIMS General Hospital for recurrent traumatic closed subluxation of the left patella. Underwent MPFL reconstruction with hamstring graft on 3 May 2023. Discharged hemodynamically stable.",
  "care_plan": "Strict non-weight-bearing on left leg with long knee brace for 6 weeks. Follow step-by-step physiotherapy protocol. Report to Orthopaedics OPD on 18 May 2023 for suture removal.",
  "values": null
}
```

---

### 7.2 Prescription Document Response (`medicines`)

```json
{
  "document_type": "Prescription",
  "extracted_text": "Dr. Sarah Smith, MD\nPatient: John Doe, Age: 45\nRx:\n1. Amoxicillin 500mg - 1 tab TID x 7 days\n2. Paracetamol 650mg - 1 tab SOS",
  "discharge_data": null,
  "medicines": [
    "Amoxicillin 500mg",
    "Paracetamol 650mg"
  ],
  "summary": null,
  "care_plan": null,
  "values": null
}
```

---

### 7.3 Lab Test / Bill Response (`values`)

```json
{
  "document_type": "Lab Report",
  "extracted_text": "Complete Blood Count (CBC)\nHemoglobin: 14.2 g/dL\nWBC: 6,800 /uL\nPlatelets: 240,000 /uL",
  "discharge_data": null,
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

## 8. HTTP Status Codes & Error Handling

| HTTP Status Code | Meaning | Cause | Action |
| :--- | :--- | :--- | :--- |
| **`200 OK`** | Success | Document processed successfully. | Parse the JSON response. |
| **`422 Unprocessable Entity`** | Validation Error | Missing the `file` parameter or body is not `multipart/form-data`. | Ensure form key is named `"file"`. |
| **`500 Internal Server Error`** | Processing Error | Corrupted image/PDF or upstream inference error. | Check document integrity; retry with exponential backoff. |

### Recommended Retry Strategy
For HTTP 500/503 errors (e.g. temporary network blips or LLM rate limits), implement exponential backoff with up to 3 retries (1s, 2s, 4s).
