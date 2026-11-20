"""C11 National-scale RAG test: dialects (Sylheti/Chatgaiya), geo localization, Family Card 2026."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import get_settings
from app.core.auth import create_service_jwt
from app.main import create_app


def _headers() -> dict[str, str]:
    tok = create_service_jwt(get_settings().ai_service_jwt_secret, subject="jonoshheba-api-test")
    return {"Authorization": f"Bearer {tok}"}


def test_c11_national_dialect_localized_rag_and_eval() -> None:
    client = TestClient(create_app())
    headers = _headers()

    # Sylheti dialect + Cumilla district context
    res = client.post(
        "/rag/answer-local",
        json={
            "query": "জন্ম নিবন্ধন করতে কিতা লাগবো টিয়া কত?",
            "district": "কুমিল্লা",
            "locale": "bn",
        },
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["grounded"] is True
    assert "কুমিল্লা" in body["answer"]
    assert "how_to_apply" in body["answer_template_sections"]
    assert body["citations"][0]["doc_id"] == "doc-bdris-birth-reg"

    # Family Card 2026 retrieval
    fc = client.post(
        "/rag/answer-local",
        json={
            "query": "ফ্যামিলি কার্ড ২০২৬ মাসিক কত টাকা ও নেগেটিভ লিস্ট",
            "district": "বগুড়া",
            "locale": "bn",
        },
        headers=headers,
    )
    assert fc.status_code == 200
    assert fc.json()["citations"][0]["doc_id"] == "doc-family-card-2026"

    # Full 8-division national eval
    ev = client.post("/rag/eval-national", headers=headers)
    assert ev.status_code == 200
    assert ev.json()["divisions_covered"] == 8
    assert ev.json()["accuracy"] >= 0.9
