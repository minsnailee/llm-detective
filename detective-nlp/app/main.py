from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import nlp

app = FastAPI(title="Detective NLP Service")

# 개발 편의용 CORS (프론트/백엔드 로컬 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8090"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nlp.router)

@app.get("/")
def health():
    return {"ok": True}
