import React, { useState, useRef } from 'react';
import './index.css';

interface OCRResult {
  document_type: string;
  extracted_text: string;
  medicines?: string[];
  summary?: string;
  care_plan?: string;
  values?: Record<string, string>;
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
