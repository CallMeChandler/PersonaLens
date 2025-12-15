from pydantic import BaseModel, Field
from typing import List, Optional


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


class TextMLResponse(TextSignalsResponse):
    embeddingModel: str
    embeddingDim: int
    embedding: List[float]


class DriftRequest(BaseModel):
    texts: List[str] = Field(..., min_length=2)


class DriftResponse(BaseModel):
    ok: bool
    embeddingModel: Optional[str] = None
    count: Optional[int] = None
    embeddingDim: Optional[int] = None

    similarityToCentroid: Optional[List[float]] = None
    meanSimilarity: Optional[float] = None
    minSimilarity: Optional[float] = None
    maxSimilarity: Optional[float] = None
    stdSimilarity: Optional[float] = None

    driftScore: Optional[float] = None
    outlierIndices: Optional[List[int]] = None

    error: Optional[str] = None


# ---------- Timeline Drift (NEW) ----------

class TimelineItem(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    text: str = Field(..., min_length=1)


class TimelineRequest(BaseModel):
    items: List[TimelineItem] = Field(..., min_length=2)
    window: int = Field(3, ge=2, description="Rolling window size")
    stride: int = Field(1, ge=1, description="Step size between windows")


class TimelinePairwisePoint(BaseModel):
    fromIndex: int
    toIndex: int
    fromDate: str
    toDate: str
    similarity: float
    driftScore: float


class TimelineWindowPoint(BaseModel):
    startIndex: int
    endIndex: int
    startDate: str
    endDate: str
    count: int
    meanSimilarity: float
    minSimilarity: float
    maxSimilarity: float
    stdSimilarity: float
    driftScore: float
    outlierIndices: List[int]


class TimelineResponse(BaseModel):
    ok: bool
    embeddingModel: Optional[str] = None
    count: Optional[int] = None
    window: Optional[int] = None
    stride: Optional[int] = None
    dates: Optional[List[str]] = None
    pairwise: Optional[List[TimelinePairwisePoint]] = None
    windows: Optional[List[TimelineWindowPoint]] = None
    error: Optional[str] = None
