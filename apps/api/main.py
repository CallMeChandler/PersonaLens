from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from personalens.schemas import TextRequest, TextSignalsResponse
from personalens.analyzers.text_signals import analyze_text_signals

app = FastAPI(title="PersonaLens API", version="0.1.0")

# Allow your Next.js dev server to call this API from the browser
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
