
import io
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict

from groq import Groq
from dotenv import load_dotenv
from PIL import Image
import fitz  # type: ignore

load_dotenv()

app = FastAPI(title="Ayusync Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client (automatically uses GROQ_API_KEY from env)
client = Groq()

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


class OCRResponse(BaseModel):
    document_type: str
    extracted_text: str
    medicines: Optional[List[str]] = None
    summary: Optional[str] = None
    care_plan: Optional[str] = None
    values: Optional[Dict[str, str]] = None
    discharge_data: Optional[DischargeSummaryDetails] = None



def encode_image(image: Image.Image) -> str:
    buffered = io.BytesIO()
    # Convert RGBA to RGB to avoid issues with JPEG
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    image.save(buffered, format="JPEG", quality=85)
    return base64.b64encode(buffered.getvalue()).decode('utf-8')


def process_file_to_base64_list(file_content: bytes, filename: str) -> List[str]:
    if filename.lower().endswith(".pdf"):
        pdf_document = fitz.open(stream=file_content, filetype="pdf")
        if len(pdf_document) == 0:
            raise ValueError("PDF is empty")
        
        images = []
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # Scale up for better OCR
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            images.append(encode_image(img))
        return images
    else:
        # Process standard image
        try:
            img = Image.open(io.BytesIO(file_content))
            # Resize if too large to fit in Groq limits
            img.thumbnail((2048, 2048))
            return [encode_image(img)]
        except Exception as e:
            raise ValueError(f"Invalid image file: {str(e)}")


@app.post("/api/analyze", response_model=OCRResponse)
async def analyze_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename or "unknown"
        base64_images = process_file_to_base64_list(content, filename)
        
        system_prompt = "You are a raw OCR extraction tool. Your only purpose is to output the EXACT text found in the image, verbatim. Do not summarize, analyze, explain, or converse. Just output the raw text."
        
        import json
        all_raw_text = ""
        doc_type = "Unknown"
        
        for idx, base64_image in enumerate(base64_images):
            completion = client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text", 
                                "text": "Extract all text from this image exactly as written. Respond strictly in JSON format: {\"document_type\": \"detected type\", \"extracted_text\": \"verbatim transcription of the entire document\"}"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )
            
            content_str = completion.choices[0].message.content or "{}"
            response_json = json.loads(content_str)
            
            if idx == 0:
                doc_type = response_json.get("document_type", "Unknown")
                
            page_text = response_json.get("extracted_text", "")
            if len(base64_images) > 1:
                all_raw_text += f"\n--- Page {idx+1} ---\n" + page_text
            else:
                all_raw_text += page_text

        raw_text = all_raw_text.strip()
        
        # Step 2: Agentic Workflow using fast text model
        structured_data = {}
        if raw_text:
            agent_prompt = ""
            doc_type_lower = doc_type.lower()
            if "prescription" in doc_type_lower or "rx" in doc_type_lower:
                agent_prompt = "Extract a list of all medicine names from the following text. Respond strictly in JSON format: {\"medicines\": [\"med1\", \"med2\"]}"
            elif "discharge" in doc_type_lower or "summary" in doc_type_lower or "discharge" in raw_text.lower()[:1000]:
                agent_prompt = """You are an expert clinical data extraction assistant.
Extract all clinical information from this hospital discharge summary into a standardized, consistent JSON structure.
If any field or detail is not present in the document text, set it to null or an empty list. Do not invent details.

Respond strictly in JSON format matching this schema:
{
  "summary": "A concise 2-3 sentence overview of patient admission, diagnosis, procedures, and discharge condition.",
  "care_plan": "A concise overview paragraph summarizing post-discharge instructions and precautions.",
  "discharge_data": {
    "patient_info": {
      "name": "Patient full name or null",
      "age": "Patient age or null",
      "gender": "Patient gender or null",
      "hospital_name": "Hospital or clinic name or null",
      "admission_date": "Admission date or null",
      "discharge_date": "Discharge date or null"
    },
    "diagnosis": "Primary and secondary diagnoses or null",
    "procedures": ["Surgeries, interventions, or procedures performed, or empty list"],
    "hospital_course": "Summary of treatment given during the hospital stay or null",
    "condition_at_discharge": "Patient status upon discharge (e.g. Hemodynamically stable) or null",
    "discharge_medications": [
      {
        "name": "Medicine name and strength",
        "dosage": "e.g. 1 tablet",
        "frequency": "e.g. twice daily / after food",
        "duration": "e.g. 7 days",
        "instructions": "Specific administration advice or empty string"
      }
    ],
    "care_plan": {
      "activity_restrictions": ["Physical activity restrictions, limb elevation, brace usage, etc."],
      "dietary_instructions": "Diet instructions or null",
      "physiotherapy": ["Step-by-step physiotherapy, ROM milestones, or exercises"],
      "wound_care": "Wound dressing, hygiene, and inspection advice or null",
      "warning_signs": ["Complications, red flags, or symptoms requiring immediate attention"],
      "emergency_contact": "Emergency phone number or contact advice or null"
    },
    "follow_up": {
      "date": "Review / appointment date or null",
      "department_or_doctor": "Doctor or department name or null",
      "instructions": "Follow-up purpose like suture removal, labs, or checks"
    }
  }
}"""
            elif "lab" in doc_type_lower or "bill" in doc_type_lower or "report" in doc_type_lower:
                agent_prompt = "Extract key values (like test results or billing amounts) from this text. Respond strictly in JSON format: {\"values\": {\"Key\": \"Value\"}}"
            elif doc_type != "Unknown" and doc_type != "Other":
                agent_prompt = "Extract key values and important details from this text. Respond strictly in JSON format: {\"values\": {\"Key\": \"Value\"}}"
                
            if agent_prompt:
                try:
                    agent_completion = client.chat.completions.create(
                        model="openai/gpt-oss-120b",
                        messages=[
                            {"role": "system", "content": agent_prompt},
                            {"role": "user", "content": raw_text}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.0
                    )
                    agent_response_str = agent_completion.choices[0].message.content or "{}"
                    structured_data = json.loads(agent_response_str)
                except Exception as ex:
                    print(f"Agent step failed: {ex}")

        discharge_data = None
        if "discharge_data" in structured_data and isinstance(structured_data["discharge_data"], dict):
            try:
                discharge_data = DischargeSummaryDetails(**structured_data["discharge_data"])
            except Exception as e:
                print(f"Failed to parse DischargeSummaryDetails: {e}")
                discharge_data = None

        medicines = structured_data.get("medicines")
        if not medicines and discharge_data and discharge_data.discharge_medications:
            medicines = [m.name for m in discharge_data.discharge_medications if m.name]

        return OCRResponse(
            document_type=doc_type,
            extracted_text=raw_text,
            medicines=medicines,
            summary=structured_data.get("summary"),
            care_plan=structured_data.get("care_plan"),
            values=structured_data.get("values"),
            discharge_data=discharge_data
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
