from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File
import tempfile
import os

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
from personalens.analyzers.audio_shift import analyze_audio_shift_bytes
from personalens.analyzers.video_shift import analyze_video_shift




app = FastAPI(title="PersonaLens API", version="0.4.0")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://persona-lens-v1.vercel.app",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,      # set True only if you use cookies/auth
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


@app.post("/analyze/audio/shift")
async def analyze_audio_shift(
    file: UploadFile = File(...),
    use_embeddings: bool = True,
    embedding_model: str = "facebook/wav2vec2-base",
    alpha: float = 0.5,
):
    data = await file.read()
    return analyze_audio_shift_bytes(
        data,
        use_embeddings=use_embeddings,
        embedding_model=embedding_model,
        combine_alpha=alpha,
    )

@app.post("/analyze/video/shift")
async def analyze_video_shift_route(
    file: UploadFile = File(...),
    model_name: str = "MCG-NJU/videomae-base",
    frames_per_segment: int = 16,
    target_fps: float = 8.0,
    window_sec: float = 4.0,
    hop_sec: float = 2.0,
    baseline_sec: float = 20.0,
    thr: float = 1.25,
    max_seconds: float = 300.0,
):
    # Persist upload to temp file so PyAV can open it reliably.
    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.flush()
        tmp.close()

        result = analyze_video_shift(
            file_path=tmp.name,
            model_name=model_name,
            frames_per_segment=frames_per_segment,
            target_fps=target_fps,
            window_sec=window_sec,
            hop_sec=hop_sec,
            baseline_sec=baseline_sec,
            thr=thr,
            max_seconds=max_seconds,
        )
        return result
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

