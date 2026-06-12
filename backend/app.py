import os
import json
import uuid
import datetime
from fastapi import FastAPI, HTTPException, Header, Response, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# Import helper modules
try:
    from backend.detector import detect_drift
    from backend.ai_analyzer import analyze_drifts
    from backend.report_generator import generate_markdown_report, generate_pdf_report
except ImportError:
    # Handle if run directly or as a module
    from detector import detect_drift
    from ai_analyzer import analyze_drifts
    from report_generator import generate_markdown_report, generate_pdf_report

app = FastAPI(
    title="Config Drift Detector API",
    description="Backend API for comparing JSON/YAML configurations and performing AI impact analysis."
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

# Pydantic Schemas
class AnalyzeRequest(BaseModel):
    intended_content: str = Field(..., description="Content of the intended config file")
    actual_content: str = Field(..., description="Content of the actual/live config file")
    intended_name: str = Field("intended_config.json", description="Filename of the intended config")
    actual_name: str = Field("actual_config.json", description="Filename of the actual config")
    file_format: str = Field("auto", description="File format: json, yaml, or auto")
    api_key: Optional[str] = Field(None, description="Optional Gemini API key override")

class ExportRequest(BaseModel):
    intended_file: str
    actual_file: str
    risk_score: int
    drifts: List[Dict[str, Any]]

# Helper: Load/Save History
def load_history() -> List[Dict[str, Any]]:
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_history(entry: Dict[str, Any]):
    history = load_history()
    # Insert at the beginning so recent is first
    history.insert(0, entry)
    # Limit to 50 entries
    history = history[:50]
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Failed to save history: {e}")

# Endpoints
@app.post("/api/analyze")
async def analyze_config_drift(req: AnalyzeRequest):
    try:
        # 1. Compare files using DeepDiff
        drifts = detect_drift(req.intended_content, req.actual_content, req.file_format)
        
        # 2. Run AI Analysis (or rule-based fallback)
        analyzed_drifts = analyze_drifts(drifts, req.api_key)
        
        # 3. Calculate statistics
        total_drifts = len(analyzed_drifts)
        breaking_count = sum(1 for d in analyzed_drifts if d.get("severity") == "Breaking")
        functional_count = sum(1 for d in analyzed_drifts if d.get("severity") == "Functional")
        cosmetic_count = sum(1 for d in analyzed_drifts if d.get("severity") == "Cosmetic")
        
        # Risk score formula
        if total_drifts == 0:
            risk_score = 0
        else:
            score = (breaking_count * 30) + (functional_count * 10) + (cosmetic_count * 2)
            if breaking_count > 0:
                score = max(50, score)
            risk_score = min(100, score)
            
        # 4. Save to history
        history_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.datetime.now().isoformat(),
            "intended_file": req.intended_name,
            "actual_file": req.actual_name,
            "total_drifts": total_drifts,
            "breaking_count": breaking_count,
            "functional_count": functional_count,
            "cosmetic_count": cosmetic_count,
            "risk_score": risk_score,
            "drifts": analyzed_drifts
        }
        save_history(history_entry)
        
        # Return results
        return history_entry
        
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/api/export/pdf")
async def export_pdf(req: ExportRequest):
    try:
        data = {
            "intended_file": req.intended_file,
            "actual_file": req.actual_file,
            "risk_score": req.risk_score,
            "drifts": req.drifts
        }
        pdf_bytes = generate_pdf_report(data)
        
        # Return as downloadable attachment
        filename = f"drift_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

@app.post("/api/export/markdown")
async def export_markdown(req: ExportRequest):
    try:
        data = {
            "intended_file": req.intended_file,
            "actual_file": req.actual_file,
            "risk_score": req.risk_score,
            "drifts": req.drifts
        }
        md_text = generate_markdown_report(data)
        return {"markdown": md_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Markdown report: {str(e)}")

@app.get("/api/history")
async def get_history():
    return load_history()

@app.post("/api/history/clear")
async def clear_history():
    try:
        if os.path.exists(HISTORY_FILE):
            os.remove(HISTORY_FILE)
        return {"status": "success", "message": "History cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/history/{run_id}")
async def delete_history_entry(run_id: str):
    try:
        history = load_history()
        updated = [h for h in history if h.get("id") != run_id]
        if len(updated) == len(history):
            raise HTTPException(status_code=404, detail="History entry not found")
        with open(HISTORY_FILE, "w") as f:
            json.dump(updated, f, indent=2)
        return {"status": "success", "message": "Entry deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Root & Static serving logic
@app.get("/")
async def serve_home():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Config Drift Detector API is running, but frontend/index.html was not found. Please build the frontend."}

# Mount static files (js, css, etc.) if frontend directory exists
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
else:
    # Create frontend dir dynamically so mounting won't crash later
    os.makedirs(FRONTEND_DIR, exist_ok=True)
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
