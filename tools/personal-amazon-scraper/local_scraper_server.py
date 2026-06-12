#!/usr/bin/env python3
"""
Local companion server for KDPIntel verified analyses.

The web app calls this server on the user's Mac. The server runs the personal
Amazon scraper, submits verified books to Supabase, and returns the Supabase
analysis job id.
"""

from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SCRAPER = Path(__file__).resolve().parent / "scrape_amazon_kdp.py"
HOST = "0.0.0.0"
PORT = 8788
JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        print(fmt % args)

    def do_OPTIONS(self) -> None:
        json_response(self, 200, {"ok": True})

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            json_response(
                self,
                200,
                {
                    "ok": True,
                    "service": "kdpintel-local-scraper",
                    "message": "Raccoglitore locale attivo",
                },
            )
            return

        if self.path.startswith("/status"):
            from urllib.parse import parse_qs, urlparse

            query = parse_qs(urlparse(self.path).query)
            job_id = (query.get("jobId") or [""])[0]
            with JOBS_LOCK:
                job = JOBS.get(job_id)

            if not job:
                json_response(self, 404, {"ok": False, "error": "Job not found"})
                return

            json_response(self, 200, {"ok": True, "job": job})
            return

        json_response(self, 404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/analyze":
            json_response(self, 404, {"ok": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            niche = str(payload.get("niche") or "").strip()
            max_books = int(payload.get("maxBooks") or 8)
            min_bsr_books = int(payload.get("minBsrBooks") or 3)
            max_reviews_per_book = int(payload.get("maxReviewsPerBook") or 8)
            zip_code = str(payload.get("zipCode") or "10001").strip()
            headful = bool(payload.get("headful", True))

            if len(niche) < 3:
                json_response(self, 400, {"ok": False, "error": "Keyword troppo corta"})
                return

            max_books = max(1, min(max_books, 12))
            min_bsr_books = max(1, min(min_bsr_books, max_books))
            max_reviews_per_book = max(1, min(max_reviews_per_book, 8))
            command = [
                sys.executable,
                str(SCRAPER),
                niche,
                "--max-books",
                str(max_books),
                "--min-bsr-books",
                str(min_bsr_books),
                "--zip-code",
                zip_code,
                "--max-reviews-per-book",
                str(max_reviews_per_book),
                "--submit",
            ]
            if headful:
                command.append("--headful")

            job_id = str(uuid.uuid4())
            now = time.time()
            with JOBS_LOCK:
                JOBS[job_id] = {
                    "id": job_id,
                    "status": "running",
                    "phase": "starting",
                    "startedAt": now,
                    "updatedAt": now,
                    "logs": "",
                    "supabase": None,
                    "error": None,
                }

            json_response(
                self,
                202,
                {
                    "ok": True,
                    "message": "Raccolta verificata avviata in background",
                    "jobId": job_id,
                },
            )
            threading.Thread(target=run_scraper_job, args=(job_id, command), daemon=True).start()
        except subprocess.TimeoutExpired:
            json_response(self, 504, {"ok": False, "error": "Raccolta dati troppo lenta: riprova con meno libri"})
        except Exception as error:
            json_response(self, 500, {"ok": False, "error": str(error)})


def update_job(job_id: str, **values: Any) -> None:
    with JOBS_LOCK:
        current = JOBS.get(job_id)
        if not current:
            return
        current.update(values)
        current["updatedAt"] = time.time()


def run_scraper_job(job_id: str, command: list[str]) -> None:
    try:
        update_job(job_id, phase="running_scraper")
        completed = subprocess.run(
            command,
            cwd=str(ROOT),
            text=True,
            capture_output=True,
            timeout=18 * 60,
        )
        output = "\n".join(part for part in [completed.stdout, completed.stderr] if part.strip())

        if completed.returncode != 0:
            update_job(
                job_id,
                status="failed",
                phase="scraper_failed",
                error="Raccolta dati non completata",
                logs=output[-4000:],
            )
            return

        json_start = completed.stdout.rfind("{")
        result = None
        if json_start >= 0:
            try:
                result = json.loads(completed.stdout[json_start:])
            except json.JSONDecodeError:
                result = None

        update_job(
            job_id,
            status="completed",
            phase="submitted_to_supabase",
            supabase=result,
            logs=output[-4000:],
        )
    except subprocess.TimeoutExpired:
        update_job(
            job_id,
            status="failed",
            phase="timeout",
            error="Raccolta dati troppo lenta: riprova con meno libri",
        )
    except Exception as error:
        update_job(job_id, status="failed", phase="error", error=str(error))


def main() -> int:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"KDPIntel local scraper server: http://127.0.0.1:{PORT}/health")
    print("Lascia questa finestra aperta mentre usi l'app.")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
