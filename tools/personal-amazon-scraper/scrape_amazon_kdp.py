#!/usr/bin/env python3
"""
Small personal Amazon/KDP data collector for KDPIntel.

It deliberately runs slowly and gathers only a handful of results. The goal is
personal research data quality, not high-volume scraping.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright non e' installato. Installa prima i requirements dello scraper.", file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
PROFILE_DIR = ROOT / ".local" / "amazon-playwright-profile"


def sleep_like_a_person(min_seconds: float = 2.0, max_seconds: float = 5.0) -> None:
    time.sleep(random.uniform(min_seconds, max_seconds))


def parse_int(value: Any) -> int:
    match = re.search(r"([\d,]+)", str(value or ""))
    return int(match.group(1).replace(",", "")) if match else 0


def parse_float(value: Any) -> float:
    match = re.search(r"(\d+(?:\.\d+)?)", str(value or ""))
    return float(match.group(1)) if match else 0.0


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env

    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def detect_blocked_page(text: str) -> bool:
    lowered = text.lower()
    return any(
        phrase in lowered
        for phrase in [
            "enter the characters you see below",
            "sorry, we just need to make sure you're not a robot",
            "captcha",
            "automated access",
        ]
    )


def search_books(page: Any, niche: str, max_books: int) -> list[dict[str, Any]]:
    query = f"{niche} book"
    url = "https://www.amazon.com/s?" + urllib.parse.urlencode(
        {
            "k": query,
            "i": "stripbooks",
            "s": "exact-aware-popularity-rank",
        }
    )

    print(f"Apro ricerca Amazon: {query}")
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    sleep_like_a_person(3.0, 6.0)

    body = page.locator("body").inner_text(timeout=10000)
    if detect_blocked_page(body):
        raise RuntimeError("Amazon ha mostrato un blocco/captcha. Apri lo scraper in modalita' visibile e riprova piu' tardi.")

    items = page.eval_on_selector_all(
        '[data-component-type="s-search-result"]',
        """nodes => nodes.map((node, index) => {
          const text = (selector) => node.querySelector(selector)?.textContent?.trim() || "";
          const attr = (selector, name) => node.querySelector(selector)?.getAttribute(name) || "";
          const asin = node.getAttribute("data-asin") || "";
          const link = node.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]')?.href || "";
          const title = text("h2") || text("h2 span") || text('[data-cy="title-recipe"]');
          const imageUrl = attr("img.s-image", "src");
          const price = text(".a-price .a-offscreen");
          const rating = text("i.a-icon-star-small span.a-icon-alt, i.a-icon-star span.a-icon-alt");
          const reviews = text('a[href*="customerReviews"] span.a-size-base, span[aria-label$="ratings"]');
          const authorCandidates = Array.from(node.querySelectorAll(".a-row .a-size-base"))
            .map((el) => el.textContent?.trim() || "")
            .filter(Boolean);
          return { index, asin, link, title, imageUrl, price, rating, reviews, authorCandidates };
        })""",
    )

    seen: set[str] = set()
    books: list[dict[str, Any]] = []

    for item in items:
        asin = str(item.get("asin") or "").upper()
        if not asin:
            match = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", str(item.get("link") or ""), re.I)
            asin = match.group(1).upper() if match else ""

        title = str(item.get("title") or "").strip()
        if not asin or asin in seen or len(title) < 5:
            continue

        seen.add(asin)
        authors = [
            candidate
            for candidate in item.get("authorCandidates", [])
            if candidate and not re.search(r"paperback|hardcover|kindle|audible|\$", candidate, re.I)
        ]

        books.append(
            {
                "title": title[:220],
                "author": authors[0] if authors else "Unknown Author",
                "asin": asin,
                "coverUrl": item.get("imageUrl") or "",
                "price": parse_float(item.get("price")),
                "rating": parse_float(item.get("rating")),
                "reviews": parse_int(item.get("reviews")),
                "bsr": 0,
                "pages": 0,
                "format": "Paperback",
                "publishDate": "",
                "amazonUrl": f"https://www.amazon.com/dp/{asin}",
                "searchPosition": len(books) + 1,
            }
        )

        if len(books) >= max_books:
            break

    return books


def enrich_book_detail(page: Any, book: dict[str, Any]) -> dict[str, Any]:
    print(f"Leggo BSR: {book['asin']} - {book['title'][:70]}")
    page.goto(book["amazonUrl"], wait_until="domcontentloaded", timeout=45000)
    sleep_like_a_person(2.5, 5.5)

    body = page.locator("body").inner_text(timeout=15000)
    if detect_blocked_page(body):
        raise RuntimeError("Amazon ha mostrato un blocco/captcha durante la lettura del prodotto.")

    bsr_patterns = [
        r"Best Sellers Rank\s*#?([\d,]+)\s+in\s+Books",
        r"#([\d,]+)\s+in\s+Books\b",
        r"Best Sellers Rank\s*:\s*#?([\d,]+)",
    ]
    for pattern in bsr_patterns:
        match = re.search(pattern, body, re.I)
        if match:
            book["bsr"] = parse_int(match.group(1))
            break

    pages_patterns = [
        r"Print length\s*([0-9,]+)\s+pages",
        r"Paperback\s*([0-9,]+)\s+pages",
        r"Hardcover\s*([0-9,]+)\s+pages",
    ]
    for pattern in pages_patterns:
        match = re.search(pattern, body, re.I)
        if match:
            book["pages"] = parse_int(match.group(1))
            break

    if not book["price"]:
        try:
            price_text = page.locator(".a-price .a-offscreen").first.inner_text(timeout=2000)
            book["price"] = parse_float(price_text)
        except PlaywrightTimeoutError:
            pass

    if not book["rating"]:
        rating_match = re.search(r"([0-5](?:\.\d)?)\s+out of 5 stars", body, re.I)
        if rating_match:
            book["rating"] = parse_float(rating_match.group(1))

    if not book["reviews"]:
        review_match = re.search(r"([\d,]+)\s+(?:ratings|customer reviews)", body, re.I)
        if review_match:
            book["reviews"] = parse_int(review_match.group(1))

    date_match = re.search(r"Publication date\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})", body, re.I)
    if date_match:
        book["publishDate"] = date_match.group(1)

    return book


def save_payload(niche: str, books: list[dict[str, Any]]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", niche.lower()).strip("-") or "niche"
    output_path = OUTPUT_DIR / f"{slug}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    payload = {
        "niche": niche,
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "source": "personal-amazon-playwright",
        "books": books,
        "booksWithBsr": len([book for book in books if int(book.get("bsr") or 0) > 0]),
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return output_path


def submit_to_kdpintel(niche: str, books: list[dict[str, Any]]) -> dict[str, Any]:
    env = {**load_env_file(ROOT / ".env"), **os.environ}
    supabase_url = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
    anon_key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("VITE_SUPABASE_ANON_KEY")

    if not supabase_url or not anon_key:
        raise RuntimeError("Mancano VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY nel file .env.")

    request = urllib.request.Request(
        f"{supabase_url.rstrip('/')}/functions/v1/analyze-niche",
        data=json.dumps({"niche": niche, "localBooks": books}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {anon_key}",
            "apikey": anon_key,
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Personal Amazon KDP scraper for KDPIntel.")
    parser.add_argument("niche", help="Keyword/niche da analizzare")
    parser.add_argument("--max-books", type=int, default=8, help="Numero massimo di libri da leggere")
    parser.add_argument("--headful", action="store_true", help="Mostra il browser mentre raccoglie i dati")
    parser.add_argument("--submit", action="store_true", help="Invia i dati raccolti all'analisi KDPIntel")
    args = parser.parse_args()

    if args.max_books < 1 or args.max_books > 20:
        raise SystemExit("--max-books deve essere tra 1 e 20.")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=not args.headful,
            viewport={"width": 1440, "height": 1000},
            locale="en-US",
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        )
        page = browser.new_page()

        try:
            books = search_books(page, args.niche, args.max_books)
            print(f"Trovati {len(books)} candidati. Ora leggo le schede prodotto.")

            enriched: list[dict[str, Any]] = []
            for book in books:
                try:
                    enriched_book = enrich_book_detail(page, book)
                    if int(enriched_book.get("bsr") or 0) > 0:
                        enriched.append(enriched_book)
                    else:
                        print(f"Scarto senza BSR: {book['asin']} - {book['title'][:70]}")
                except Exception as error:
                    print(f"Errore su {book['asin']}: {error}")
                sleep_like_a_person(3.0, 7.0)
        finally:
            browser.close()

    output_path = save_payload(args.niche, enriched)
    print(f"Salvato: {output_path}")
    print(f"Libri con BSR reale: {len(enriched)}")

    if args.submit:
        if not enriched:
            raise SystemExit("Nessun libro con BSR reale: non invio l'analisi.")
        result = submit_to_kdpintel(args.niche, enriched)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
