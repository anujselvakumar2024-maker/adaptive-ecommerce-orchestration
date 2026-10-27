from typing import (
    Any,
    Dict,
    List,
    Literal,
    Optional
)

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from search_engine import SearchEngine
from evaluator import Evaluator
from experiment_store import ExperimentStore

import json
import os


app = FastAPI(
    title="Adaptive E-Commerce Search API",
    version="1.0"
)


# Allow friend's frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCENARIOS_PATH = os.path.join(BASE_DIR, "data", "scenarios.json")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

engine = SearchEngine()
evaluator = Evaluator(engine)
store = ExperimentStore()

if os.path.isdir(RESULTS_DIR):
    app.mount("/results", StaticFiles(directory=RESULTS_DIR), name="results")


# =====================================================
# REQUEST MODELS
# =====================================================

class SearchRequest(BaseModel):

    query: str

    mode: Literal[
        "baseline",
        "optimized",
        "orchestrated"
    ]

    category: Literal[
        "phone",
        "laptop",
        "watch",
        "refrigerator"
    ]

    search_type: Literal[
        "specific",
        "general"
    ]

    k: int = Field(
        default=5,
        ge=1,
        le=20
    )


class EvaluationRequest(BaseModel):

    search_type: Literal[
        "specific",
        "general"
    ]

    results: List[
        Dict[str, Any]
    ]

    target_product_id: Optional[str] = None

    target_constraints: Optional[
        Dict[str, Any]
    ] = None


class SessionUpsertRequest(BaseModel):

    session_id: str = Field(..., min_length=2, max_length=64)
    consent_given: bool = True
    status: Literal["in_progress", "completed"] = "in_progress"


class TaskLogRequest(BaseModel):

    session_id: str = Field(..., min_length=2, max_length=64)
    task_number: int = Field(default=1, ge=1, le=20)
    scenario_id: str = Field(..., min_length=1, max_length=100)
    search_type: Literal["specific", "general"]
    category: Literal["phone", "laptop", "watch", "refrigerator"]
    query: str = Field(..., min_length=1, max_length=500)
    hidden_target: Dict[str, Any] = Field(default_factory=dict)
    assignment: Dict[str, Any] = Field(default_factory=dict)
    results_by_mode: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    evaluations_by_mode: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class QuestionnaireData(BaseModel):

    overall_satisfaction: int = Field(..., ge=1, le=5)
    perceived_relevance: int = Field(..., ge=1, le=5)
    ease_of_finding: int = Field(..., ge=1, le=5)
    perceived_usefulness: int = Field(..., ge=1, le=5)
    perceived_diversity: int = Field(..., ge=1, le=5)
    product_confidence: int = Field(..., ge=1, le=5)
    purchase_intention: int = Field(..., ge=1, le=5)
    return_intention: int = Field(..., ge=1, le=5)
    repeat_purchase_intention: int = Field(..., ge=1, le=5)
    target_retrieval_outcome: Literal["exact", "alternative", "none"]
    preferred_condition: Literal[
        "baseline",
        "optimized",
        "orchestrated",
        "no_preference"
    ]
    condition_ratings: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    comments: Optional[str] = Field(default="", max_length=1000)


class ExperimentSubmissionRequest(BaseModel):

    session_id: str = Field(..., min_length=2, max_length=64)
    search_type: Literal["specific", "general"]
    scenario_id: str = Field(..., min_length=1, max_length=100)
    category: Literal["phone", "laptop", "watch", "refrigerator"]
    query: str = Field(..., min_length=1, max_length=500)
    hidden_target: Dict[str, Any] = Field(default_factory=dict)
    assignment: Dict[str, Any] = Field(default_factory=dict)
    results_summary: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    evaluations: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    tasks_log: List[Dict[str, Any]] = Field(default_factory=list)
    questionnaire: QuestionnaireData



# =====================================================
# HEALTH
# =====================================================

@app.get("/health")
def health():

    return {
        "status": "ok",
        "products": len(
            engine.products
        )
    }

@app.get("/scenarios")
def scenarios():

    with open(
        SCENARIOS_PATH,
        "r"
    ) as f:
        data = json.load(f)

    return data


# =====================================================
# PRODUCT TARGET LIST
# For website target-selection screen
# =====================================================

@app.get("/targets")
def targets(
    category: str,
    limit: int = 30
):

    if category not in [
        "phone",
        "laptop",
        "watch",
        "refrigerator"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid category"
        )

    data = engine.products[
        engine.products["category"]
        == category
    ].copy()

    data = data.sort_values(
        "product_title"
    )

    data = data.head(limit)

    return data[
        [
            "product_id",
            "product_title",
            "product_brand",
            "product_color",
            "price"
        ]
    ].to_dict(
        orient="records"
    )


# =====================================================
# SEARCH
# Hidden target is NOT accepted here
# =====================================================

@app.post("/search")
def search(request: SearchRequest):

    try:

        return engine.search(
            query=request.query,
            mode=request.mode,
            category=request.category,
            search_type=request.search_type,
            k=request.k
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =====================================================
# EVALUATION
# Called only AFTER search results exist
# =====================================================

@app.post("/evaluate")
def evaluate(
    request: EvaluationRequest
):

    try:

        return evaluator.evaluate(
            search_type=
                request.search_type,

            results=
                request.results,

            target_product_id=
                request.target_product_id,

            target_constraints=
                request.target_constraints
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


# =====================================================
# EXPERIMENT PERSISTENCE & RESEARCHER EXPORT
# =====================================================

@app.post("/experiments/session")
def upsert_experiment_session(request: SessionUpsertRequest):

    try:
        return store.upsert_session(
            session_id=request.session_id,
            consent_given=request.consent_given,
            status=request.status
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.post("/experiments/task")
def log_experiment_task(request: TaskLogRequest):

    try:
        return store.record_task(request.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.post("/experiments/submit")
def submit_experiment(request: ExperimentSubmissionRequest):

    try:
        return store.record_submission(request.model_dump())
    except ValueError as e:
        raise HTTPException(
            status_code=409,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.get("/experiments/summary")
def get_experiment_summary():

    try:
        return store.get_summary()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.get("/experiments/export.csv")
def export_experiment_csv():

    try:
        csv_content = store.export_csv()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": 'attachment; filename="human_evaluation_results.csv"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

