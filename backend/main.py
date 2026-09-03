
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

class OCRResponse(BaseModel):
    document_type: str
    extracted_text: str
    medicines: Optional[List[str]] = None
    summary: Optional[str] = None
    care_plan: Optional[str] = None
    values: Optional[Dict[str, str]] = None


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
                agent_prompt = "Provide a concise summary of this document AND create a post-discharge care plan based on the text. Respond strictly in JSON format: {\"summary\": \"...\", \"care_plan\": \"...\"}"
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

        return OCRResponse(
            document_type=doc_type,
            extracted_text=raw_text,
            medicines=structured_data.get("medicines"),
            summary=structured_data.get("summary"),
            care_plan=structured_data.get("care_plan"),
            values=structured_data.get("values")
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
