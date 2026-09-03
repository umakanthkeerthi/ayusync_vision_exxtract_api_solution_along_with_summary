import React, { useState, useRef } from 'react';
import './index.css';

interface PatientInfo {
  name?: string | null;
  age?: string | null;
  gender?: string | null;
  hospital_name?: string | null;
  admission_date?: string | null;
  discharge_date?: string | null;
}

interface DischargeMedicationItem {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

interface CarePlanDetails {
  activity_restrictions?: string[] | null;
  dietary_instructions?: string | null;
  physiotherapy?: string[] | null;
  wound_care?: string | null;
  warning_signs?: string[] | null;
  emergency_contact?: string | null;
}

interface FollowUpDetails {
  date?: string | null;
  department_or_doctor?: string | null;
  instructions?: string | null;
}

interface DischargeSummaryDetails {
  patient_info?: PatientInfo | null;
  diagnosis?: string | null;
  procedures?: string[] | null;
  hospital_course?: string | null;
  condition_at_discharge?: string | null;
  discharge_medications?: DischargeMedicationItem[] | null;
  care_plan?: CarePlanDetails | null;
  follow_up?: FollowUpDetails | null;
}

interface OCRResult {
  document_type: string;
  extracted_text: string;
  medicines?: string[];
  summary?: string;
  care_plan?: string;
  values?: Record<string, string>;
  discharge_data?: DischargeSummaryDetails | null;
}


// Inline SVGs for reliability without extra dependencies
const ScanIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
    <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
    <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/analyze';
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Server error: ${response.statusText}`);
      }

      const data: OCRResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze document");
    } finally {
      setLoading(false);
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const triggerScan = () => {
    // In a real mobile/web environment, this could open the camera specifically
    // Here we use the file input with capture attribute
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.setAttribute("accept", "image/*");
      fileInputRef.current.click();
      
      // Reset attributes after a slight delay
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.removeAttribute("capture");
          fileInputRef.current.setAttribute("accept", "image/*,.pdf");
        }
      }, 500);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="brand-title">Ayusync</h1>
        <p className="brand-subtitle">Intelligent Medical Document Analysis</p>
      </header>

      <main className="content-area">
        {loading ? (
          <div className="loader"></div>
        ) : result ? (
          <div className="result-card">
            <span className="doc-type-badge">{result.document_type}</span>
            
            {/* Structured Discharge Summary View */}
            {result.discharge_data ? (
              <>
                {/* Patient & Hospital Info Banner */}
                {result.discharge_data.patient_info && (
                  <div className="patient-banner">
                    {result.discharge_data.patient_info.hospital_name && (
                      <div className="patient-chip">
                        <span className="chip-label">Hospital</span>
                        <span className="chip-value">{result.discharge_data.patient_info.hospital_name}</span>
                      </div>
                    )}
                    {result.discharge_data.patient_info.name && (
                      <div className="patient-chip">
                        <span className="chip-label">Patient Name</span>
                        <span className="chip-value">{result.discharge_data.patient_info.name}</span>
                      </div>
                    )}
                    {(result.discharge_data.patient_info.age || result.discharge_data.patient_info.gender) && (
                      <div className="patient-chip">
                        <span className="chip-label">Age / Gender</span>
                        <span className="chip-value">
                          {[result.discharge_data.patient_info.age ? `${result.discharge_data.patient_info.age} yrs` : null, result.discharge_data.patient_info.gender].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    )}
                    {result.discharge_data.patient_info.admission_date && (
                      <div className="patient-chip">
                        <span className="chip-label">Admitted</span>
                        <span className="chip-value">{result.discharge_data.patient_info.admission_date}</span>
                      </div>
                    )}
                    {result.discharge_data.patient_info.discharge_date && (
                      <div className="patient-chip">
                        <span className="chip-label">Discharged</span>
                        <span className="chip-value">{result.discharge_data.patient_info.discharge_date}</span>
                      </div>
                    )}
                    {result.discharge_data.condition_at_discharge && (
                      <div className="patient-chip">
                        <span className="chip-label">Status</span>
                        <span className="chip-value" style={{ color: '#10b981' }}>{result.discharge_data.condition_at_discharge}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Diagnosis & Procedures */}
                {(result.discharge_data.diagnosis || (result.discharge_data.procedures && result.discharge_data.procedures.length > 0)) && (
                  <div className="structured-section">
                    <h3>Diagnosis & Procedures</h3>
                    {result.discharge_data.diagnosis && (
                      <div className="diagnosis-box">
                        <div className="diag-title">Primary Diagnosis</div>
                        <div className="diag-text">{result.discharge_data.diagnosis}</div>
                      </div>
                    )}
                    {result.discharge_data.procedures && result.discharge_data.procedures.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <span className="chip-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Surgeries / Procedures Performed</span>
                        <ul className="medicines-list">
                          {result.discharge_data.procedures.map((proc, idx) => (
                            <li key={idx}><strong>{proc}</strong></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.discharge_data.hospital_course && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                        <span className="chip-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Hospital Course</span>
                        <p>{result.discharge_data.hospital_course}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Discharge Medications Table */}
                {result.discharge_data.discharge_medications && result.discharge_data.discharge_medications.length > 0 && (
                  <div className="structured-section">
                    <h3>Discharge Medications</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="clinical-table">
                        <thead>
                          <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Instructions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.discharge_data.discharge_medications.map((med, idx) => (
                            <tr key={idx}>
                              <td className="med-name-badge">{med.name}</td>
                              <td>{med.dosage || '-'}</td>
                              <td>{med.frequency || '-'}</td>
                              <td>{med.duration || '-'}</td>
                              <td style={{ color: '#cbd5e1' }}>{med.instructions || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Structured Recovery Care Plan */}
                {result.discharge_data.care_plan && (
                  <div className="structured-section">
                    <h3>Post-Discharge Care Plan</h3>
                    <div className="care-plan-grid">
                      {result.discharge_data.care_plan.activity_restrictions && result.discharge_data.care_plan.activity_restrictions.length > 0 && (
                        <div className="care-card">
                          <h4>🏃 Activity & Precautions</h4>
                          <ul>
                            {result.discharge_data.care_plan.activity_restrictions.map((act, i) => (
                              <li key={i}>{act}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.discharge_data.care_plan.physiotherapy && result.discharge_data.care_plan.physiotherapy.length > 0 && (
                        <div className="care-card">
                          <h4>🩺 Physiotherapy Protocol</h4>
                          <ul>
                            {result.discharge_data.care_plan.physiotherapy.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.discharge_data.care_plan.dietary_instructions && (
                        <div className="care-card">
                          <h4>🥗 Diet Instructions</h4>
                          <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                            {result.discharge_data.care_plan.dietary_instructions}
                          </p>
                        </div>
                      )}

                      {result.discharge_data.care_plan.wound_care && (
                        <div className="care-card">
                          <h4>🩹 Wound Care & Hygiene</h4>
                          <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                            {result.discharge_data.care_plan.wound_care}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Warning signs & emergency */}
                    {((result.discharge_data.care_plan.warning_signs && result.discharge_data.care_plan.warning_signs.length > 0) || result.discharge_data.care_plan.emergency_contact) && (
                      <div className="warning-box">
                        <h4>⚠️ Warning Signs & Immediate Attention</h4>
                        {result.discharge_data.care_plan.warning_signs && (
                          <ul>
                            {result.discharge_data.care_plan.warning_signs.map((ws, i) => (
                              <li key={i}>{ws}</li>
                            ))}
                          </ul>
                        )}
                        {result.discharge_data.care_plan.emergency_contact && (
                          <div className="emergency-chip">
                            <span>🚨 Emergency: {result.discharge_data.care_plan.emergency_contact}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Follow Up */}
                {result.discharge_data.follow_up && (result.discharge_data.follow_up.date || result.discharge_data.follow_up.department_or_doctor || result.discharge_data.follow_up.instructions) && (
                  <div className="structured-section">
                    <h3>Follow-Up Appointment</h3>
                    <div className="followup-box">
                      {result.discharge_data.follow_up.date && (
                        <div className="followup-date">📅 Review Date: {result.discharge_data.follow_up.date}</div>
                      )}
                      {result.discharge_data.follow_up.department_or_doctor && (
                        <div className="followup-details"><strong>Department / Doctor:</strong> {result.discharge_data.follow_up.department_or_doctor}</div>
                      )}
                      {result.discharge_data.follow_up.instructions && (
                        <div className="followup-details"><strong>Instructions:</strong> {result.discharge_data.follow_up.instructions}</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {result.medicines && result.medicines.length > 0 && (
                  <div className="structured-section">
                    <h3>Prescribed Medicines</h3>
                    <ul className="medicines-list">
                      {result.medicines.map((med, i) => <li key={i}>{med}</li>)}
                    </ul>
                  </div>
                )}
                
                {result.summary && (
                  <div className="structured-section">
                    <h3>Discharge Summary</h3>
                    <p>{result.summary}</p>
                  </div>
                )}
                
                {result.care_plan && (
                  <div className="structured-section">
                    <h3>Post-Discharge Care Plan</h3>
                    <p>{result.care_plan}</p>
                  </div>
                )}
              </>
            )}
            
            {result.values && Object.keys(result.values).length > 0 && (
              <div className="structured-section">
                <h3>Extracted Details</h3>
                <table className="values-table">
                  <tbody>
                    {Object.entries(result.values).map(([k, v], i) => (
                      <tr key={i}>
                        <td className="key-col">{k}</td>
                        <td className="val-col">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="structured-section raw-text-section" style={{ marginTop: '2rem' }}>
              <h3>Raw Extracted Text</h3>
              <div className="extracted-text">{result.extracted_text}</div>
            </div>
          </div>
        ) : error ? (
          <div className="result-card" style={{ border: '1px solid #ef4444' }}>
            <p style={{ color: '#ef4444' }}>{error}</p>
          </div>
        ) : (
          <div className="placeholder" onClick={triggerUpload}>
            <UploadIcon />
            <p style={{ marginTop: '1rem' }}>Upload or scan a document to extract text</p>
          </div>
        )}
      </main>

      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden-input" 
        accept="image/*,.pdf"
      />

      <div className="action-bar">
        <button className="btn btn-secondary" onClick={triggerScan}>
          <ScanIcon />
          Scan
        </button>
        <button className="btn btn-primary" onClick={triggerUpload}>
          <UploadIcon />
          Upload
        </button>
      </div>
    </div>
  );
}

export default App;
