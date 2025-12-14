from pydantic import BaseModel, Field


class TextRequest(BaseModel):
    text: str = Field(..., min_length=1)


class TextSignalsResponse(BaseModel):
    score: int
    wordCount: int
    sentenceCount: int
    metricHits: int
    buzzwordHits: int
    hedgeHits: int
    absoluteHits: int
    buzzwordPer100Words: float
