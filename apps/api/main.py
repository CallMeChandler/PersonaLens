from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from personalens.schemas import (
    TextRequest,
    TextSignalsResponse,
    TextMLResponse,
    DriftRequest,
    DriftResponse,
    TimelineRequest,
    TimelineResponse,
)
from personalens.analyzers.text_signals import analyze_text_signals
from personalens.analyzers.text_embeddings import embed_text, embedding_model_name
from personalens.analyzers.text_drift import analyze_text_drift
from personalens.analyzers.text_timeline import analyze_text_timeline
from personalens.schemas import ReasonsRequest, ReasonsResponse
from personalens.analyzers.text_reasons import analyze_text_reasons
from personalens.schemas import ClustersRequest, ClustersResponse
from personalens.analyzers.text_clusters import analyze_text_clusters



app = FastAPI(title="PersonaLens API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.2:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze/text", response_model=TextSignalsResponse)
def analyze(req: TextRequest):
    return analyze_text_signals(req.text)


@app.post("/analyze/text/ml", response_model=TextMLResponse)
def analyze_ml(req: TextRequest):
    signals = analyze_text_signals(req.text)
    emb = embed_text(req.text, normalize=True)
    return {
        **signals,
        "embeddingModel": embedding_model_name(),
        "embeddingDim": len(emb),
        "embedding": emb,
    }


@app.post("/analyze/text/drift", response_model=DriftResponse)
def analyze_drift(req: DriftRequest):
    return analyze_text_drift(req.texts)


@app.post("/analyze/text/timeline", response_model=TimelineResponse)
def analyze_timeline(req: TimelineRequest):
    items = [{"date": it.date, "text": it.text} for it in req.items]
    return analyze_text_timeline(items, window=req.window, stride=req.stride)

@app.post("/analyze/text/reasons", response_model=ReasonsResponse)
def analyze_reasons(req: ReasonsRequest):
    return analyze_text_reasons(req.texts, indices=req.indices)

@app.post("/analyze/text/clusters", response_model=ClustersResponse)
def analyze_clusters(req: ClustersRequest):
    return analyze_text_clusters(req.texts, k=req.k, seed=req.seed, max_iter=req.max_iter)
