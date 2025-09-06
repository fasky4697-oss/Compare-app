from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import numpy as np
import scipy.stats as stats
from sklearn.metrics import cohen_kappa_score
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class ConfusionMatrix(BaseModel):
    true_positive: int = Field(ge=0, description="จำนวน True Positive")
    false_positive: int = Field(ge=0, description="จำนวน False Positive")
    true_negative: int = Field(ge=0, description="จำนวน True Negative")
    false_negative: int = Field(ge=0, description="จำนวน False Negative")

class TechniqueData(BaseModel):
    technique_name: str = Field(description="ชื่อเทคนิค เช่น qPCR, RPA, LAMP")
    matrix: ConfusionMatrix
    confidence_level: float = Field(default=0.95, ge=0.8, le=0.99, description="ระดับความเชื่อมั่น")

class ExperimentCreate(BaseModel):
    experiment_name: str = Field(description="ชื่อการทดลอง")
    description: Optional[str] = Field(default="", description="คำอธิบายการทดลอง")
    techniques: List[TechniqueData] = Field(min_items=2, description="ข้อมูลเทคนิคต่างๆ (อย่างน้อย 2 เทคนิค)")

class DiagnosticStats(BaseModel):
    sensitivity: float = Field(description="ความไว (Sensitivity)")
    specificity: float = Field(description="ความจำเพาะ (Specificity)")
    ppv: float = Field(description="ค่าพยากรณ์เชิงบวก (PPV)")
    npv: float = Field(description="ค่าพยากรณ์เชิงลบ (NPV)")
    accuracy: float = Field(description="ความแม่นยำ (Accuracy)")
    prevalence: float = Field(description="ความชุกของโรค (Prevalence)")
    
    # Confidence intervals
    sensitivity_ci: List[float] = Field(description="CI ของ Sensitivity")
    specificity_ci: List[float] = Field(description="CI ของ Specificity")
    ppv_ci: List[float] = Field(description="CI ของ PPV")
    npv_ci: List[float] = Field(description="CI ของ NPV")

class TechniqueResult(BaseModel):
    technique_name: str
    stats: DiagnosticStats
    cohen_kappa: float = Field(description="Cohen's Kappa")
    cohen_kappa_ci: List[float] = Field(description="CI ของ Cohen's Kappa")
    interpretation: str = Field(description="การตีความผล")

class ExperimentResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    experiment_name: str
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    techniques_results: List[TechniqueResult]
    comparison_summary: Dict[str, Any] = Field(description="สรุปการเปรียบเทียบ")

# Statistical calculation functions
def calculate_diagnostic_stats(tp: int, fp: int, tn: int, fn: int, confidence_level: float = 0.95) -> DiagnosticStats:
    """คำนวณค่าสถิติทางการวินิจฉัย"""
    
    # Basic calculations
    total = tp + fp + tn + fn
    if total == 0:
        raise ValueError("Total samples cannot be zero")
    
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0
    accuracy = (tp + tn) / total
    prevalence = (tp + fn) / total
    
    # Calculate 95% confidence intervals using Wilson method
    alpha = 1 - confidence_level
    z = stats.norm.ppf(1 - alpha/2)
    
    def wilson_ci(x, n):
        if n == 0:
            return [0, 0]
        p = x / n
        denominator = 1 + (z**2 / n)
        centre = (p + (z**2 / (2*n))) / denominator
        adjustment = (z / denominator) * np.sqrt((p * (1-p) / n) + (z**2 / (4 * n**2)))
        return [max(0, centre - adjustment), min(1, centre + adjustment)]
    
    sensitivity_ci = wilson_ci(tp, tp + fn)
    specificity_ci = wilson_ci(tn, tn + fp)
    ppv_ci = wilson_ci(tp, tp + fp)
    npv_ci = wilson_ci(tn, tn + fn)
    
    return DiagnosticStats(
        sensitivity=sensitivity,
        specificity=specificity,
        ppv=ppv,
        npv=npv,
        accuracy=accuracy,
        prevalence=prevalence,
        sensitivity_ci=sensitivity_ci,
        specificity_ci=specificity_ci,
        ppv_ci=ppv_ci,
        npv_ci=npv_ci
    )

def calculate_cohen_kappa(tp: int, fp: int, tn: int, fn: int, confidence_level: float = 0.95) -> tuple:
    """คำนวณ Cohen's Kappa และ 95% CI"""
    
    # Create observed and expected arrays for sklearn
    total = tp + fp + tn + fn
    if total == 0:
        return 0.0, [0.0, 0.0]
    
    # Create confusion matrix for Cohen's kappa calculation
    y_true = [1] * (tp + fn) + [0] * (fp + tn)
    y_pred = [1] * tp + [0] * fn + [1] * fp + [0] * tn
    
    if len(set(y_true)) < 2 or len(set(y_pred)) < 2:
        return 0.0, [0.0, 0.0]
    
    kappa = cohen_kappa_score(y_true, y_pred)
    
    # Calculate standard error and CI
    po = (tp + tn) / total  # observed agreement
    pe = ((tp + fn) * (tp + fp) + (tn + fp) * (tn + fn)) / (total ** 2)  # expected agreement
    
    if pe == 1:
        return kappa, [kappa, kappa]
    
    # Standard error calculation
    se = np.sqrt((po * (1 - po)) / (total * (1 - pe) ** 2))
    
    # CI calculation
    alpha = 1 - confidence_level
    z = stats.norm.ppf(1 - alpha/2)
    ci_lower = max(-1, kappa - z * se)
    ci_upper = min(1, kappa + z * se)
    
    return kappa, [ci_lower, ci_upper]

def interpret_kappa(kappa: float) -> str:
    """ตีความค่า Cohen's Kappa"""
    if kappa < 0:
        return "ความสอดคล้องต่ำกว่าการสุ่ม (Poor agreement)"
    elif kappa < 0.2:
        return "ความสอดคล้องเล็กน้อย (Slight agreement)"
    elif kappa < 0.4:
        return "ความสอดคล้องปานกลาง (Fair agreement)"
    elif kappa < 0.6:
        return "ความสอดคล้องค่อนข้างดี (Moderate agreement)"
    elif kappa < 0.8:
        return "ความสอดคล้องดี (Substantial agreement)"
    else:
        return "ความสอดคล้องเกือบสมบูรณ์ (Almost perfect agreement)"

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Bioinformatics Nucleic Acid Amplification Comparison API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.post("/experiments", response_model=ExperimentResult)
async def create_experiment(experiment: ExperimentCreate):
    """สร้างการทดลองใหม่และคำนวณผลลัพธ์"""
    
    try:
        techniques_results = []
        
        for technique_data in experiment.techniques:
            matrix = technique_data.matrix
            
            # Calculate diagnostic statistics
            stats_result = calculate_diagnostic_stats(
                matrix.true_positive,
                matrix.false_positive,
                matrix.true_negative,
                matrix.false_negative,
                technique_data.confidence_level
            )
            
            # Calculate Cohen's Kappa
            kappa, kappa_ci = calculate_cohen_kappa(
                matrix.true_positive,
                matrix.false_positive,
                matrix.true_negative,
                matrix.false_negative,
                technique_data.confidence_level
            )
            
            # Create technique result
            technique_result = TechniqueResult(
                technique_name=technique_data.technique_name,
                stats=stats_result,
                cohen_kappa=kappa,
                cohen_kappa_ci=kappa_ci,
                interpretation=interpret_kappa(kappa)
            )
            
            techniques_results.append(technique_result)
        
        # Create comparison summary
        comparison_summary = {
            "best_sensitivity": max(techniques_results, key=lambda x: x.stats.sensitivity).technique_name,
            "best_specificity": max(techniques_results, key=lambda x: x.stats.specificity).technique_name,
            "best_accuracy": max(techniques_results, key=lambda x: x.stats.accuracy).technique_name,
            "best_kappa": max(techniques_results, key=lambda x: x.cohen_kappa).technique_name,
            "techniques_count": len(techniques_results),
            "average_sensitivity": np.mean([r.stats.sensitivity for r in techniques_results]),
            "average_specificity": np.mean([r.stats.specificity for r in techniques_results]),
            "average_accuracy": np.mean([r.stats.accuracy for r in techniques_results])
        }
        
        # Create experiment result
        result = ExperimentResult(
            experiment_name=experiment.experiment_name,
            description=experiment.description,
            techniques_results=techniques_results,
            comparison_summary=comparison_summary
        )
        
        # Save to database
        result_dict = result.dict()
        result_dict['created_at'] = result_dict['created_at'].isoformat()
        await db.experiments.insert_one(result_dict)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing experiment: {str(e)}")

@api_router.get("/experiments", response_model=List[ExperimentResult])
async def get_experiments():
    """ดึงรายการการทดลองทั้งหมด"""
    experiments = await db.experiments.find().sort("created_at", -1).to_list(100)
    
    for exp in experiments:
        if isinstance(exp.get('created_at'), str):
            exp['created_at'] = datetime.fromisoformat(exp['created_at'])
    
    return [ExperimentResult(**exp) for exp in experiments]

@api_router.get("/experiments/{experiment_id}", response_model=ExperimentResult)
async def get_experiment(experiment_id: str):
    """ดึงข้อมูลการทดลองตาม ID"""
    experiment = await db.experiments.find_one({"id": experiment_id})
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if isinstance(experiment.get('created_at'), str):
        experiment['created_at'] = datetime.fromisoformat(experiment['created_at'])
    
    return ExperimentResult(**experiment)

@api_router.delete("/experiments/{experiment_id}")
async def delete_experiment(experiment_id: str):
    """ลบการทดลอง"""
    result = await db.experiments.delete_one({"id": experiment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return {"message": "Experiment deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()