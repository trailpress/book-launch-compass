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
import ssl
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import certifi
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Dipendenze scraper mancanti. Installa prima i requirements dello scraper.", file=sys.stderr)
    sys.exit(1)

try:
    from pytrends.request import TrendReq
except ImportError:
    TrendReq = None

try:
    import praw
except ImportError:
    praw = None


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
PROFILE_DIR = ROOT / ".local" / "amazon-playwright-profile"
SOCIAL_PROFILE_DIR = ROOT / ".local" / "social-playwright-profile"
TRENDS_CACHE_DIR = ROOT / ".local" / "google-trends-cache"
DEFAULT_US_ZIP_CODE = "10001"
GENERIC_TITLE_WORDS = {
    "book",
    "books",
    "guide",
    "guides",
    "guidebook",
    "guidebooks",
    "travel",
    "complete",
    "ultimate",
    "best",
    "new",
    "updated",
    "edition",
    "handbook",
    "manual",
    "introduction",
    "workbook",
    "checklist",
    "planner",
    "journal",
    "logbook",
    "and",
    "the",
    "for",
    "with",
    "from",
    "your",
}


def sleep_like_a_person(min_seconds: float = 2.0, max_seconds: float = 5.0) -> None:
    time.sleep(random.uniform(min_seconds, max_seconds))


def parse_int(value: Any) -> int:
    match = re.search(r"([\d,]+)", str(value or ""))
    return int(match.group(1).replace(",", "")) if match else 0


def parse_float(value: Any) -> float:
    match = re.search(r"(\d+(?:\.\d+)?)", str(value or ""))
    return float(match.group(1)) if match else 0.0


def detect_currency(value: Any) -> str:
    text = str(value or "")
    if "$" in text or "USD" in text.upper():
        return "USD"
    if "€" in text or "EUR" in text.upper():
        return "EUR"
    if "£" in text or "GBP" in text.upper():
        return "GBP"
    return ""


def tokenize_for_relevance(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if len(token) > 2 and token not in GENERIC_TITLE_WORDS and not re.fullmatch(r"20\d{2}", token)
    ]


def title_relevance_score(niche: str, title: str) -> tuple[float, str]:
    required = tokenize_for_relevance(niche)
    if not required:
        return 1.0, "no specific niche tokens"

    title_tokens = set(tokenize_for_relevance(title))
    matched = [token for token in required if token in title_tokens]
    ratio = len(matched) / len(required)

    if len(required) <= 2:
        passes = len(matched) == len(required)
    else:
        first_token_present = required[0] in title_tokens
        passes = first_token_present and ratio >= 0.67

    return (ratio if passes else ratio - 1), f"matched {len(matched)}/{len(required)}: {', '.join(matched) or 'none'}"


def is_title_relevant(niche: str, title: str) -> bool:
    score, _ = title_relevance_score(niche, title)
    return score >= 0


def text_relevance_score(niche: str, text: str, min_ratio: float = 0.35) -> tuple[bool, float, str]:
    required = tokenize_for_relevance(niche)
    if not required:
        return True, 1.0, "no specific niche tokens"

    lowered = text.lower()
    matched = [token for token in required if token in lowered]
    ratio = len(matched) / len(required)
    if len(required) <= 2:
        passes = len(matched) == len(required)
    else:
        passes = required[0] in lowered and ratio >= max(min_ratio, 0.66)
    return passes, ratio, f"matched {len(matched)}/{len(required)}: {', '.join(matched) or 'none'}"


def clean_text(value: Any, max_length: int = 1200) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_length]


def strip_html(value: str, max_length: int = 1200) -> str:
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return clean_text(text, max_length)


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


def set_us_delivery_location(page: Any, zip_code: str) -> bool:
    print(f"Imposto mercato Amazon USA con CAP {zip_code}")
    page.goto("https://www.amazon.com/?language=en_US&currency=USD", wait_until="domcontentloaded", timeout=45000)
    sleep_like_a_person(2.0, 4.0)

    body = page.locator("body").inner_text(timeout=10000)
    if detect_blocked_page(body):
        raise RuntimeError("Amazon ha mostrato un blocco/captcha mentre impostavo il mercato USA.")

    try:
        page.locator("#nav-global-location-popover-link").click(timeout=5000)
        sleep_like_a_person(1.0, 2.0)
        zip_input = page.locator("#GLUXZipUpdateInput")
        zip_input.fill(zip_code, timeout=5000)
        page.locator("#GLUXZipUpdate").click(timeout=5000)
        sleep_like_a_person(2.0, 3.5)

        done_buttons = [
            "#GLUXConfirmClose",
            "span[data-action='GLUXConfirmAction'] input",
            "button[name='glowDoneButton']",
        ]
        for selector in done_buttons:
            try:
                if page.locator(selector).first.isVisible():
                    page.locator(selector).first.click(timeout=3000)
                    break
            except Exception:
                continue

        sleep_like_a_person(1.0, 2.0)
        return True
    except Exception as error:
        print(f"Non sono riuscito a impostare il CAP via interfaccia Amazon: {error}")
        return False


def build_search_queries(niche: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", niche.strip().lower())
    queries = [
        normalized,
        f"{normalized} book",
        f"{normalized} books",
        f"{normalized} guidebook",
    ]

    without_book_words = re.sub(r"\b(book|books|guidebook|guidebooks)\b", "", normalized).strip()
    if without_book_words:
        queries.extend([
            f"{without_book_words} book",
            f"{without_book_words} guidebook",
        ])

    if "travel guide" in normalized:
        destination = normalized.replace("travel guide", "").strip()
        if destination:
            queries.extend([
                f"{destination} travel guide",
                f"{destination} guidebook",
                f"{destination} hiking guide",
            ])

    result: list[str] = []
    for query in queries:
        cleaned = re.sub(r"\s+", " ", query).strip()
        if cleaned and cleaned not in result:
            result.append(cleaned)
    return result[:8]


def derive_topic_queries(niche: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", niche.lower()).strip()
    base = re.sub(r"\b(travel guide|guidebook|guide|book|books|handbook|manual|workbook|planner|checklist)\b", " ", normalized)
    base = re.sub(r"\s+", " ", base).strip() or normalized
    queries = [
        normalized,
        base,
        f"{base} itinerary",
        f"{base} tips",
        f"{base} recommendations",
        f"{base} first time",
        f"{base} where to stay",
        f"{base} mistakes",
    ]
    result: list[str] = []
    for query in queries:
        cleaned = re.sub(r"\s+", " ", query).strip()
        if cleaned and cleaned not in result:
            result.append(cleaned)
    return result[:8]


def extract_search_items(page: Any) -> list[dict[str, Any]]:
    return page.eval_on_selector_all(
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
          const reviewLink = node.querySelector('a[href*="customerReviews"], a[href*="#customerReviews"]');
          const reviews = [
            reviewLink?.textContent?.trim() || "",
            reviewLink?.getAttribute("aria-label") || "",
            text('span[aria-label$="ratings"], span[aria-label$="rating"]'),
          ].find(Boolean) || "";
          const authorCandidates = Array.from(node.querySelectorAll(".a-row .a-size-base"))
            .map((el) => el.textContent?.trim() || "")
            .filter(Boolean);
          return { index, asin, link, title, imageUrl, price, rating, reviews, authorCandidates };
        })""",
    )


def search_books(page: Any, niche: str, max_candidates: int) -> list[dict[str, Any]]:
    seen: set[str] = set()
    books: list[dict[str, Any]] = []

    for query in build_search_queries(niche):
        if len(books) >= max_candidates:
            break

        for page_number in [1, 2]:
            if len(books) >= max_candidates:
                break

            params = {
                "k": query,
                "i": "stripbooks",
                "s": "exact-aware-popularity-rank",
            }
            if page_number > 1:
                params["page"] = str(page_number)
            url = "https://www.amazon.com/s?" + urllib.parse.urlencode(params)

            print(f"Apro ricerca Amazon: {query} (pagina {page_number})")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            sleep_like_a_person(3.0, 6.0)

            body = page.locator("body").inner_text(timeout=10000)
            if detect_blocked_page(body):
                raise RuntimeError("Amazon ha mostrato un blocco/captcha. Apri lo scraper in modalita' visibile e riprova piu' tardi.")

            items = extract_search_items(page)
            print(f"Candidati trovati in questa ricerca: {len(items)}")

            for item in items:
                asin = str(item.get("asin") or "").upper()
                if not asin:
                    match = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", str(item.get("link") or ""), re.I)
                    asin = match.group(1).upper() if match else ""

                title = str(item.get("title") or "").strip()
                if not asin or asin in seen or len(title) < 5:
                    continue

                relevance_score, relevance_reason = title_relevance_score(niche, title)
                if relevance_score < 0:
                    print(f"Scarto candidato poco pertinente ({relevance_reason}): {title[:90]}")
                    continue

                seen.add(asin)
                authors = [
                    candidate
                    for candidate in item.get("authorCandidates", [])
                    if candidate
                    and candidate.strip().lower() != "by"
                    and not re.search(r"paperback|hardcover|kindle|audible|\$", candidate, re.I)
                ]

                books.append(
                    {
                        "title": title[:220],
                        "author": authors[0] if authors else "Unknown Author",
                        "asin": asin,
                        "coverUrl": item.get("imageUrl") or "",
                        "price": parse_float(item.get("price")),
                        "priceCurrency": detect_currency(item.get("price")),
                        "rating": parse_float(item.get("rating")),
                        "reviews": parse_int(item.get("reviews")),
                        "bsr": 0,
                        "pages": 0,
                        "format": "Paperback",
                        "publishDate": "",
                        "amazonUrl": f"https://www.amazon.com/dp/{asin}",
                        "searchPosition": len(books) + 1,
                        "searchQuery": query,
                        "relevanceScore": round(relevance_score, 3),
                        "relevanceReason": relevance_reason,
                        "fieldEvidence": {
                            "asin": {"sourceUrl": url, "rawText": asin},
                            "title": {"sourceUrl": url, "rawText": title[:300]},
                            "price": {"sourceUrl": url, "rawText": str(item.get("price") or "")[:120]},
                            "rating": {"sourceUrl": url, "rawText": str(item.get("rating") or "")[:120]},
                            "reviews": {"sourceUrl": url, "rawText": str(item.get("reviews") or "")[:120]},
                        },
                    }
                )

                if len(books) >= max_candidates:
                    break

    return books


def enrich_book_detail(page: Any, book: dict[str, Any]) -> dict[str, Any]:
    print(f"Leggo BSR: {book['asin']} - {book['title'][:70]}")
    page.goto(book["amazonUrl"], wait_until="domcontentloaded", timeout=45000)
    sleep_like_a_person(2.5, 5.5)

    body = page.locator("body").inner_text(timeout=15000)
    if detect_blocked_page(body):
        raise RuntimeError("Amazon ha mostrato un blocco/captcha durante la lettura del prodotto.")

    if not book.get("author") or str(book.get("author")).strip().lower() in {"by", "unknown author"}:
        try:
            authors = page.eval_on_selector_all(
                '#bylineInfo .author a, #bylineInfo a.contributorNameID, .author a, a.contributorNameID',
                """nodes => nodes.map((node) => node.textContent?.trim() || "").filter(Boolean)""",
            )
            clean_authors = [
                author
                for author in authors
                if author and author.strip().lower() != "by" and len(author.strip()) > 1
            ]
            if clean_authors:
                book["author"] = ", ".join(dict.fromkeys(clean_authors))
                book.setdefault("fieldEvidence", {})["author"] = {
                    "sourceUrl": book["amazonUrl"],
                    "rawText": book["author"][:200],
                }
            else:
                book["author"] = "Unknown Author"
        except Exception:
            book["author"] = "Unknown Author"

    bsr_patterns = [
        r"Best Sellers Rank\s*#?([\d,]+)\s+in\s+Books",
        r"#([\d,]+)\s+in\s+Books\b",
        r"Best Sellers Rank\s*:\s*#?([\d,]+)",
    ]
    for pattern in bsr_patterns:
        match = re.search(pattern, body, re.I)
        if match:
            book["bsr"] = parse_int(match.group(1))
            book.setdefault("fieldEvidence", {})["bsr"] = {
                "sourceUrl": book["amazonUrl"],
                "rawText": match.group(0)[:300],
            }
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
            book.setdefault("fieldEvidence", {})["pages"] = {
                "sourceUrl": book["amazonUrl"],
                "rawText": match.group(0)[:300],
            }
            break

    if not book["price"]:
        try:
            price_text = page.locator(".a-price .a-offscreen").first.inner_text(timeout=2000)
            book["price"] = parse_float(price_text)
            book["priceCurrency"] = detect_currency(price_text)
            book.setdefault("fieldEvidence", {})["price"] = {
                "sourceUrl": book["amazonUrl"],
                "rawText": price_text[:120],
            }
        except PlaywrightTimeoutError:
            pass

    if not book["rating"]:
        rating_match = re.search(r"([0-5](?:\.\d)?)\s+out of 5 stars", body, re.I)
        if rating_match:
            book["rating"] = parse_float(rating_match.group(1))
            book.setdefault("fieldEvidence", {})["rating"] = {
                "sourceUrl": book["amazonUrl"],
                "rawText": rating_match.group(0)[:120],
            }

    if not book["reviews"]:
        review_match = re.search(r"([\d,]+)\s+(?:global\s+)?(?:ratings?|customer ratings?)", body, re.I)
        if review_match:
            book["reviews"] = parse_int(review_match.group(1))
            book.setdefault("fieldEvidence", {})["reviews"] = {
                "sourceUrl": book["amazonUrl"],
                "rawText": review_match.group(0)[:120],
            }

    date_match = re.search(r"Publication date\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})", body, re.I)
    if date_match:
        book["publishDate"] = date_match.group(1)
        book.setdefault("fieldEvidence", {})["publishDate"] = {
            "sourceUrl": book["amazonUrl"],
            "rawText": date_match.group(0)[:160],
        }

    return book


def extract_amazon_review_items(page: Any) -> list[dict[str, Any]]:
    return page.eval_on_selector_all(
        '[data-hook="review"], .review',
        """nodes => nodes.map((node) => {
          const text = (selector) => node.querySelector(selector)?.textContent?.trim() || "";
          return {
            title: text('[data-hook="review-title"], .review-title'),
            body: text('[data-hook="review-body"], .review-text'),
            rating: text('[data-hook="review-star-rating"], .review-rating'),
            helpful: text('[data-hook="helpful-vote-statement"]'),
            author: text('.a-profile-name'),
            rawText: node.innerText || node.textContent || "",
          };
        })""",
    )


def parse_amazon_review_item(item: dict[str, Any], niche: str, asin: str, review_url: str, book_title: str, seen: set[str]) -> tuple[str, dict[str, Any]] | None:
    title = clean_text(item.get("title"), 220)
    body_text = clean_text(item.get("body"), 1400)
    raw_text = str(item.get("rawText") or "")[:2600]

    if not body_text and raw_text:
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        skipped_patterns = re.compile(
            r"^(verified purchase|format:|reviewed in|read more|helpful|report|customer image|one person found|\\d+ people found)",
            re.I,
        )
        body_lines = [
            line
            for line in lines
            if len(line) > 25 and not skipped_patterns.search(line) and not re.search(r"^[1-5](?:\\.0)? out of 5 stars$", line, re.I)
        ]
        body_text = clean_text(" ".join(body_lines[-6:]), 1400)

    if len(body_text) < 45:
        return None

    combined = clean_text(f"{title}: {body_text}" if title else body_text, 1500)
    key = combined[:180].lower()
    if key in seen:
        return None

    _relevant, score, _reason = text_relevance_score(niche, combined, 0.15)
    seen.add(key)
    excerpt = {
        "content": combined[:1000],
        "source": "Amazon",
        "url": review_url,
        "relevanceScore": min(100, 65 + round(score * 25)),
        "author": clean_text(item.get("author"), 80),
        "rating": parse_float(item.get("rating")),
        "helpful": parse_int(item.get("helpful")),
        "asin": asin,
        "bookTitle": book_title,
    }
    return combined, excerpt


def scrape_amazon_reviews(page: Any, niche: str, books: list[dict[str, Any]], max_per_book: int = 8) -> tuple[list[str], list[dict[str, Any]], list[str]]:
    reviews: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen: set[str] = set()

    for book in books[:5]:
        asin = str(book.get("asin") or "").strip().upper()
        if not asin:
            continue

        review_urls = [
            f"https://www.amazon.com/product-reviews/{asin}/?reviewerType=all_reviews&sortBy=helpful",
            f"https://www.amazon.com/product-reviews/{asin}/?reviewerType=all_reviews&sortBy=recent",
            f"https://www.amazon.com/dp/{asin}",
        ]
        print(f"Leggo recensioni Amazon: {asin} - {book.get('title', '')[:70]}")

        try:
            book_review_count = 0
            for review_url in review_urls:
                if book_review_count >= max_per_book:
                    break

                page.goto(review_url, wait_until="domcontentloaded", timeout=45000)
                sleep_like_a_person(2.5, 5.0)
                body = page.locator("body").inner_text(timeout=12000)
                if detect_blocked_page(body):
                    print("Amazon ha mostrato un blocco/captcha sulle recensioni; salto questo URL.")
                    continue

                items = extract_amazon_review_items(page)
                for item in items:
                    parsed = parse_amazon_review_item(
                        item,
                        niche,
                        asin,
                        review_url,
                        str(book.get("title", "")),
                        seen,
                    )
                    if not parsed:
                        continue
                    combined, excerpt = parsed
                    reviews.append(combined)
                    sources.append(review_url)
                    excerpts.append(excerpt)
                    book_review_count += 1
                    if book_review_count >= max_per_book:
                        break

                if book_review_count >= max_per_book:
                    break

            print(f"Recensioni pertinenti raccolte per {asin}: {book_review_count}")
        except Exception as error:
            print(f"Errore recensioni Amazon {asin}: {error}")

        sleep_like_a_person(2.5, 5.5)

    return reviews, excerpts, list(dict.fromkeys(sources))


def scrape_google_trends_pytrends(niche: str) -> dict[str, Any] | None:
    if TrendReq is None:
        print("pytrends non installato: salto Google Trends locale.")
        return None

    cache_slug = re.sub(r"[^a-z0-9]+", "-", niche.lower()).strip("-") or "niche"
    cache_path = TRENDS_CACHE_DIR / f"{cache_slug}.json"

    def load_cached_trends(max_age_hours: int = 72) -> dict[str, Any] | None:
        try:
            if not cache_path.exists():
                return None
            cached = json.loads(cache_path.read_text())
            collected_at = datetime.fromisoformat(str(cached.get("collectedAt", "")).replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - collected_at).total_seconds() / 3600
            if age_hours > max_age_hours:
                print(f"Cache Google Trends troppo vecchia ({age_hours:.1f}h).")
                return None
            payload = cached.get("data")
            if not isinstance(payload, dict) or not payload.get("data"):
                return None
            payload["source"] = "pytrends-cache"
            payload["trendsAnalysis"] = f"{payload.get('trendsAnalysis', '')} Dato riusato da cache locale verificata ({age_hours:.1f}h fa).".strip()
            return payload
        except Exception as cache_error:
            print(f"Cache Google Trends non leggibile ({cache_error}).")
            return None

    try:
        print(f"Cerco Google Trends locale via pytrends: {niche}")
        pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25), retries=0, backoff_factor=0.5)
        pytrends.build_payload([niche], cat=0, timeframe="today 12-m", geo="US", gprop="")
        interest = pytrends.interest_over_time()
        if interest is None or interest.empty or niche not in interest:
            return load_cached_trends()

        series = interest[niche].dropna()
        values = [int(value) for value in series.tolist() if int(value) >= 0]
        labels = [str(index.date()) for index in series.index.tolist()]
        if not values or max(values) <= 0:
            return None

        avg = sum(values) / len(values)
        first_window = values[: max(1, min(4, len(values) // 3))]
        last_window = values[-max(1, min(4, len(values) // 3)) :]
        first_avg = sum(first_window) / len(first_window)
        last_avg = sum(last_window) / len(last_window)
        direction = "growing" if last_avg > first_avg * 1.15 else "declining" if last_avg < first_avg * 0.85 else "stable"
        viability = "strong" if avg >= 45 else "moderate" if avg >= 20 else "weak"
        seasonality = "high" if max(values) - min(values) >= 45 else "moderate" if max(values) - min(values) >= 20 else "low"
        year_over_year = round(((last_avg - first_avg) / first_avg) * 100) if first_avg else 0
        related_terms: list[str] = []
        try:
            related = pytrends.related_queries() or {}
            niche_related = related.get(niche) or {}
            for key in ("rising", "top"):
                frame = niche_related.get(key)
                if frame is None or getattr(frame, "empty", True):
                    continue
                for query in frame.get("query", []).tolist():
                    term = clean_text(query, 80)
                    if term and term.lower() != niche.lower() and term not in related_terms:
                        related_terms.append(term)
                    if len(related_terms) >= 10:
                        break
                if len(related_terms) >= 10:
                    break
        except Exception as related_error:
            print(f"Query correlate Google Trends non disponibili ({related_error}).")

        peak_indexes = sorted(range(len(values)), key=lambda index: values[index], reverse=True)[:3]
        peak_labels = [labels[index] for index in sorted(peak_indexes)]

        result = {
            "direction": direction,
            "seasonality": seasonality,
            "viability": viability,
            "data": values[-52:],
            "labels": labels[-52:],
            "narrative": f"Google Trends US verificato via pytrends: interesse medio {avg:.0f}/100, direzione {direction}, variazione periodo iniziale/finale {year_over_year:+d}%.",
            "relatedQueries": related_terms,
            "relatedSearchTerms": related_terms,
            "trendsAnalysis": (
                f"Google Trends US mostra interesse {direction} con media {avg:.0f}/100 negli ultimi 12 mesi. "
                f"Picchi osservati: {', '.join(peak_labels) if peak_labels else 'non disponibili'}. "
                f"Query correlate: {', '.join(related_terms[:5]) if related_terms else 'non disponibili'}."
            ),
            "yearOverYear": year_over_year,
            "peakDates": peak_labels,
            "source": "pytrends",
        }
        try:
            TRENDS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps({
                "niche": niche,
                "collectedAt": datetime.now(timezone.utc).isoformat(),
                "data": result,
            }, ensure_ascii=False, indent=2))
        except Exception as cache_error:
            print(f"Cache Google Trends non salvata ({cache_error}).")

        return result
    except Exception as error:
        print(f"Google Trends locale non disponibile ({error}).")
        return load_cached_trends()


def fetch_url(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "KDPIntelPersonalResearch/1.0 (personal market research)",
            "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
        },
    )
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=timeout, context=ssl_context) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_json(url: str, timeout: int = 20) -> dict[str, Any]:
    return json.loads(fetch_url(url, timeout=timeout))


def normalize_search_url(raw_url: str) -> str:
    decoded = urllib.parse.unquote(unescape(raw_url or ""))
    if "uddg=" in decoded:
        parsed = urllib.parse.urlparse(decoded)
        decoded = urllib.parse.parse_qs(parsed.query).get("uddg", [decoded])[0]
        decoded = urllib.parse.unquote(decoded)
    if decoded.startswith("/url?") or decoded.startswith("https://www.google.com/url?"):
        parsed = urllib.parse.urlparse(decoded)
        decoded = urllib.parse.parse_qs(parsed.query).get("q", [decoded])[0]
    decoded = decoded.split("&sa=")[0].split("&ved=")[0].rstrip("/")
    return decoded


def source_from_url(url: str) -> str:
    lower = url.lower()
    if "reddit.com" in lower:
        return "Reddit"
    if "quora.com" in lower:
        return "Quora"
    if "youtube.com" in lower or "youtu.be" in lower:
        return "YouTube"
    if any(token in lower for token in ["forum", "tripadvisor.com", "fodors.com", "lonelyplanet.com/thorntree"]):
        return "Forum"
    return "Blog"


def extract_public_search_results(html: str, niche: str, allowed_domains: list[str], max_items: int) -> tuple[str, list[dict[str, Any]], list[str]]:
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_urls: set[str] = set()

    candidates: list[tuple[str, str]] = []

    # DuckDuckGo html endpoint.
    for match in re.finditer(
        r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>',
        html,
        re.I,
    ):
        candidates.append((normalize_search_url(match.group(1)), strip_html(match.group(2), 260)))

    # Bing.
    for block in re.findall(r'<li class="b_algo"[\s\S]*?</li>', html, re.I):
        link_match = re.search(r'<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', block, re.I)
        if link_match:
            snippet_match = re.search(r'<p[^>]*>([\s\S]*?)</p>', block, re.I)
            title = strip_html(link_match.group(2), 260)
            snippet = strip_html(snippet_match.group(1), 700) if snippet_match else ""
            candidates.append((normalize_search_url(link_match.group(1)), clean_text(f"{title}. {snippet}", 900)))

    # Generic fallback for visible URLs in search HTML.
    for raw_url in re.findall(r"https?://[^\"'<>\\\s]+", html):
        candidates.append((normalize_search_url(raw_url), ""))

    plain = strip_html(html, 30000)
    allowed = [domain.lower() for domain in allowed_domains]

    for url, text in candidates:
        if len(excerpts) >= max_items:
            break
        lower_url = url.lower()
        if not url.startswith("http") or url in seen_urls:
            continue
        if allowed and not any(domain in lower_url for domain in allowed):
            continue
        if any(skip in lower_url for skip in ["/profile/", "/user/", "/account/", "/login", "/signin", "/search?"]):
            continue

        if not text:
            marker = lower_url.replace("https://www.", "").replace("https://", "").replace("http://", "")[:42]
            idx = plain.lower().find(marker)
            text = plain[max(0, idx - 500): idx + 900] if idx >= 0 else ""
            text = clean_text(text, 900)

        if len(text) < 45:
            parsed_path = urllib.parse.urlparse(url).path.replace("-", " ").replace("_", " ")
            text = clean_text(parsed_path, 500)

        relevant, score, reason = text_relevance_score(niche, text[:700], 0.2)
        if not relevant:
            print(f"Scarto risultato web poco pertinente ({reason}): {url[:90]}")
            continue

        source = source_from_url(url)
        seen_urls.add(url)
        sources.append(url)
        raw_parts.append(f"=== PUBLIC {source.upper()} SIGNAL ({url}) ===\n{text[:1200]}")
        excerpts.append(
            {
                "content": text[:500],
                "source": source,
                "url": url,
                "relevanceScore": min(100, 55 + round(score * 35)),
            }
        )

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def scrape_public_web_signals(niche: str, max_items_per_source: int = 6) -> tuple[str, list[dict[str, Any]], list[str]]:
    targets = [
        ("Reddit", ["reddit.com"], [
            f'site:reddit.com "{niche}"',
            f'site:reddit.com {niche} recommendation advice review',
        ]),
        ("Quora", ["quora.com"], [
            f'site:quora.com "{niche}"',
            f'site:quora.com {niche} advice recommendations question',
        ]),
        ("YouTube", ["youtube.com/watch", "youtu.be"], [
            f'site:youtube.com/watch "{niche}" review',
            f'site:youtube.com/watch {niche} tips guide',
        ]),
        ("Forum", ["forum", "tripadvisor.com", "fodors.com", "lonelyplanet.com"], [
            f'"{niche}" forum advice',
            f'"{niche}" trip report tips',
        ]),
    ]
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_urls: set[str] = set()

    for label, domains, queries in targets:
        source_count = 0
        for query in queries:
            if source_count >= max_items_per_source:
                break

            try:
                print(f"Cerco segnali pubblici {label} via RSS: {query}")
                rss_raw, rss_found, rss_sources = scrape_bing_rss_results(
                    query,
                    niche,
                    domains,
                    max_items_per_source - source_count,
                )
                if rss_raw:
                    raw_parts.append(rss_raw)
                for item in rss_found:
                    if item["url"] in seen_urls:
                        continue
                    seen_urls.add(item["url"])
                    excerpts.append(item)
                    source_count += 1
                sources.extend(rss_sources)
            except Exception as error:
                print(f"RSS pubblico {label} non disponibile ({error}).")

            search_urls = [
                "https://www.bing.com/search?" + urllib.parse.urlencode({"q": query}),
                "https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query}),
            ]
            for search_url in search_urls:
                if source_count >= max_items_per_source:
                    break
                try:
                    print(f"Cerco segnali pubblici {label}: {query}")
                    html = fetch_url(search_url, timeout=18)
                    raw, found, found_sources = extract_public_search_results(
                        html,
                        niche,
                        domains,
                        max_items_per_source - source_count,
                    )
                    if raw:
                        raw_parts.append(raw)
                    for item in found:
                        if item["url"] in seen_urls:
                            continue
                        seen_urls.add(item["url"])
                        excerpts.append(item)
                        source_count += 1
                    sources.extend(found_sources)
                except Exception as error:
                    print(f"Ricerca pubblica {label} non disponibile ({error}).")
            sleep_like_a_person(0.8, 1.8)

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def scrape_bing_rss_results(query: str, niche: str, allowed_domains: list[str], max_items: int) -> tuple[str, list[dict[str, Any]], list[str]]:
    url = "https://www.bing.com/search?" + urllib.parse.urlencode({"q": query, "format": "rss"})
    xml_text = fetch_url(url, timeout=18)
    root = ET.fromstring(xml_text)
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    allowed = [domain.lower() for domain in allowed_domains]

    for item in root.findall(".//item"):
        if len(excerpts) >= max_items:
            break

        title = clean_text(item.findtext("title") or "", 260)
        link = normalize_search_url(item.findtext("link") or "")
        description = strip_html(item.findtext("description") or "", 800)
        content = clean_text(f"{title}. {description}" if description else title, 900)
        lower_url = link.lower()

        if not link.startswith("http"):
            continue
        if allowed and not any(domain in lower_url for domain in allowed):
            continue
        if any(skip in lower_url for skip in ["/profile/", "/user/", "/account/", "/login", "/signin", "/search?"]):
            continue

        relevant, score, reason = text_relevance_score(niche, content[:700], 0.2)
        if not relevant:
            print(f"Scarto RSS pubblico poco pertinente ({reason}): {link[:90]}")
            continue

        source = source_from_url(link)
        sources.append(link)
        raw_parts.append(f"=== PUBLIC {source.upper()} RSS SIGNAL ({link}) ===\n{content[:1200]}")
        excerpts.append(
            {
                "content": content[:500],
                "source": source,
                "url": link,
                "relevanceScore": min(100, 55 + round(score * 35)),
            }
        )

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def parse_old_reddit_search(html: str, niche: str, max_items: int) -> tuple[str, list[dict[str, Any]], list[str]]:
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    raw_parts: list[str] = []

    blocks = re.findall(
        r'<div class=" search-result search-result-link[\s\S]*?(?=<div class=" search-result search-result-|</div></div></div></div>|</body>)',
        html,
        re.I,
    )

    for block in blocks:
        title_match = re.search(r'<a href="([^"]+)" class="search-title[^"]*"[^>]*>([\s\S]*?)</a>', block, re.I)
        if not title_match:
            continue

        url = unescape(title_match.group(1))
        if url.startswith("/"):
            url = f"https://old.reddit.com{url}"
        title = strip_html(title_match.group(2), 220)
        body_match = re.search(r'<div class="search-result-body">([\s\S]*?)(?:</div>\s*</div>|</div>\s*<div class="search-result-footer")', block, re.I)
        body = strip_html(body_match.group(1), 900) if body_match else ""
        content = clean_text(f"{title}. {body}" if body else title, 1000)
        if len(content) < 45:
            continue

        lead_content = clean_text(f"{title}. {body[:350]}", 600)
        topic_focus = derive_topic_queries(niche)[1] if len(derive_topic_queries(niche)) > 1 else niche
        relevant, score, reason = text_relevance_score(topic_focus, lead_content, 0.18)
        if not relevant:
            print(f"Scarto old Reddit poco pertinente ({reason}): {content[:80]}")
            continue
        if not re.search(
            r"\b(guide|recommend|recommendation|advice|trip|plan|planning|itinerary|tips?|review|help|question|visit|hike|book|ebook)\b",
            content,
            re.I,
        ):
            print(f"Scarto old Reddit senza intento informativo: {content[:80]}")
            continue

        score_match = re.search(r'<span class="search-score">([\d,]+)\s+points?</span>', block, re.I)
        comments_match = re.search(r'class="search-comments[^"]*"[^>]*>([\d,]+)\s+comments?</a>', block, re.I)
        author_match = re.search(r'class="author[^"]*"[^>]*>([^<]+)</a>', block, re.I)
        subreddit_match = re.search(r'class="search-subreddit-link[^"]*"[^>]*>r/([^<]+)</a>', block, re.I)
        datetime_match = re.search(r'<time[^>]+datetime="([^"]+)"', block, re.I)

        upvotes = parse_int(score_match.group(1) if score_match else 0)
        comments = parse_int(comments_match.group(1) if comments_match else 0)
        subreddit = clean_text(subreddit_match.group(1) if subreddit_match else "", 80)
        author = clean_text(author_match.group(1) if author_match else "", 80)
        date_posted = clean_text(datetime_match.group(1) if datetime_match else "", 80)

        sources.append(url)
        raw_parts.append(
            f"=== REAL REDDIT DISCUSSION ({url}) ===\n"
            f"Subreddit: r/{subreddit} | Upvotes: {upvotes} | Comments: {comments}\n"
            f"{content}"
        )
        excerpts.append(
            {
                "content": content[:500],
                "source": "Reddit",
                "url": url,
                "upvotes": upvotes,
                "comments": comments,
                "relevanceScore": min(100, 55 + round(score * 35) + min(10, comments // 10)),
                "author": author,
                "subreddit": subreddit,
                "datePosted": date_posted,
            }
        )

        if len(excerpts) >= max_items:
            break

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def scrape_reddit_public(niche: str, max_items: int = 12) -> tuple[str, list[dict[str, Any]], list[str]]:
    topic_queries = derive_topic_queries(niche)
    queries = [f'"{topic_queries[0]}"'] + topic_queries[1:6]
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    raw_parts: list[str] = []
    seen_urls: set[str] = set()

    for query in queries:
        if len(excerpts) >= max_items:
            break

        params = urllib.parse.urlencode({"q": query, "sort": "relevance", "t": "year", "limit": 10})
        url = f"https://www.reddit.com/search.json?{params}"
        print(f"Cerco Reddit pubblico: {query}")

        try:
            payload = json.loads(fetch_url(url, timeout=25))
            children = payload.get("data", {}).get("children", [])
        except Exception as error:
            print(f"Reddit JSON non disponibile ({error}); salto questa query.")
            children = []

        if not children:
            try:
                old_url = f"https://old.reddit.com/search?{params}"
                html = fetch_url(old_url, timeout=25)
                old_raw, old_excerpts, old_sources = parse_old_reddit_search(html, niche, max_items - len(excerpts))
                raw_parts.extend(old_raw.split("\n\n") if old_raw else [])
                for item in old_excerpts:
                    if item["url"] not in seen_urls:
                        seen_urls.add(item["url"])
                        excerpts.append(item)
                sources.extend(old_sources)
                if old_excerpts:
                    print(f"Old Reddit fallback: {len(old_excerpts)} risultati pertinenti")
            except Exception as error:
                print(f"Old Reddit fallback non disponibile ({error}).")

        for child in children:
            data = child.get("data", {}) if isinstance(child, dict) else {}
            permalink = data.get("permalink") or ""
            reddit_url = f"https://www.reddit.com{permalink}" if permalink.startswith("/") else data.get("url") or ""
            if not reddit_url or reddit_url in seen_urls:
                continue

            title = clean_text(data.get("title"), 220)
            body = clean_text(data.get("selftext"), 900)
            content = clean_text(f"{title}. {body}" if body else title, 1000)
            if len(content) < 45:
                continue

            lead_content = clean_text(f"{title}. {body[:350]}", 600)
            relevant, score, reason = text_relevance_score(topic_queries[1] if len(topic_queries) > 1 else niche, lead_content, 0.18)
            if not relevant:
                print(f"Scarto Reddit poco pertinente ({reason}): {content[:80]}")
                continue
            if not re.search(
                r"\b(guide|recommend|recommendation|advice|trip|plan|planning|itinerary|tips?|review|help|question|visit|hike|book|ebook)\b",
                content,
                re.I,
            ):
                print(f"Scarto Reddit senza intento informativo: {content[:80]}")
                continue

            seen_urls.add(reddit_url)
            sources.append(reddit_url)
            raw_parts.append(
                f"=== REAL REDDIT DISCUSSION ({reddit_url}) ===\n"
                f"Subreddit: r/{data.get('subreddit') or ''} | Upvotes: {data.get('ups') or 0} | Comments: {data.get('num_comments') or 0}\n"
                f"{content}"
            )
            excerpts.append(
                {
                    "content": content[:500],
                    "source": "Reddit",
                    "url": reddit_url,
                    "upvotes": int(data.get("ups") or 0),
                    "comments": int(data.get("num_comments") or 0),
                    "relevanceScore": min(100, 55 + round(score * 35) + min(10, int(data.get("num_comments") or 0) // 10)),
                    "author": data.get("author") or "",
                    "subreddit": data.get("subreddit") or "",
                    "datePosted": datetime.fromtimestamp(int(data.get("created_utc") or 0), timezone.utc).isoformat()
                    if data.get("created_utc")
                    else "",
                }
            )
            if len(excerpts) >= max_items:
                break

        sleep_like_a_person(1.0, 2.5)

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def scrape_reddit_praw(niche: str, max_items: int = 12) -> tuple[str, list[dict[str, Any]], list[str]]:
    env = {**load_env_file(ROOT / ".env"), **os.environ}
    client_id = env.get("REDDIT_CLIENT_ID", "").strip()
    client_secret = env.get("REDDIT_CLIENT_SECRET", "").strip()
    user_agent = env.get("REDDIT_USER_AGENT", "KDPIntelPersonalResearch/1.0").strip()

    if praw is None:
        print("PRAW non installato: salto Reddit API.")
        return "", [], []
    if not client_id or not client_secret:
        print("Credenziali Reddit API assenti: salto Reddit API.")
        return "", [], []

    topic_queries = derive_topic_queries(niche)
    queries = [topic_queries[1] if len(topic_queries) > 1 else niche, topic_queries[0], *topic_queries[2:5]]
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_urls: set[str] = set()

    try:
        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
            check_for_async=False,
        )
    except Exception as error:
        print(f"Reddit API non inizializzata ({error}).")
        return "", [], []

    for query in queries:
        if len(excerpts) >= max_items:
            break
        try:
            print(f"Cerco Reddit API: {query}")
            submissions = reddit.subreddit("all").search(query, sort="relevance", time_filter="year", limit=max_items * 2)
            for submission in submissions:
                if len(excerpts) >= max_items:
                    break

                reddit_url = f"https://www.reddit.com{submission.permalink}"
                if reddit_url in seen_urls:
                    continue

                title = clean_text(getattr(submission, "title", ""), 220)
                body = clean_text(getattr(submission, "selftext", ""), 1000)
                content = clean_text(f"{title}. {body}" if body else title, 1200)
                if len(content) < 45:
                    continue

                relevant, score, reason = text_relevance_score(
                    topic_queries[1] if len(topic_queries) > 1 else niche,
                    content,
                    0.18,
                )
                if not relevant:
                    print(f"Scarto Reddit API poco pertinente ({reason}): {content[:80]}")
                    continue

                top_comments: list[str] = []
                try:
                    submission.comments.replace_more(limit=0)
                    scored_comments = sorted(
                        [comment for comment in submission.comments.list() if getattr(comment, "body", None)],
                        key=lambda comment: int(getattr(comment, "score", 0) or 0),
                        reverse=True,
                    )
                    for comment in scored_comments[:3]:
                        comment_body = clean_text(getattr(comment, "body", ""), 500)
                        if comment_body and "[deleted]" not in comment_body.lower():
                            top_comments.append(f"[{int(getattr(comment, 'score', 0) or 0)} upvotes] {comment_body}")
                except Exception as error:
                    print(f"Commenti Reddit API non disponibili per {reddit_url[:90]} ({error}).")

                discussion_text = "\n".join([content, *top_comments]).strip()
                seen_urls.add(reddit_url)
                sources.append(reddit_url)
                raw_parts.append(
                    f"=== REAL REDDIT API DISCUSSION ({reddit_url}) ===\n"
                    f"Subreddit: r/{submission.subreddit.display_name} | Upvotes: {int(getattr(submission, 'score', 0) or 0)} | Comments: {int(getattr(submission, 'num_comments', 0) or 0)}\n"
                    f"{discussion_text}"
                )
                excerpts.append(
                    {
                        "content": discussion_text[:1000],
                        "source": "Reddit",
                        "url": reddit_url,
                        "upvotes": int(getattr(submission, "score", 0) or 0),
                        "comments": int(getattr(submission, "num_comments", 0) or 0),
                        "relevanceScore": min(100, 60 + round(score * 30) + min(10, int(getattr(submission, "num_comments", 0) or 0) // 10)),
                        "author": str(getattr(submission, "author", "") or ""),
                        "subreddit": submission.subreddit.display_name,
                        "datePosted": datetime.fromtimestamp(int(getattr(submission, "created_utc", 0) or 0), timezone.utc).isoformat()
                        if getattr(submission, "created_utc", None)
                        else "",
                    }
                )
        except Exception as error:
            print(f"Reddit API ricerca non disponibile ({error}).")

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def scrape_reddit_with_browser(niche: str, max_items: int = 12) -> tuple[str, list[dict[str, Any]], list[str]]:
    topic_queries = derive_topic_queries(niche)
    queries = topic_queries[2:8] + topic_queries[1:2] if len(topic_queries) > 2 else topic_queries
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_urls: set[str] = set()
    topic_focus = topic_queries[1] if len(topic_queries) > 1 else niche

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch_persistent_context(
            str(SOCIAL_PROFILE_DIR),
            headless=True,
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
            for query in queries:
                if len(excerpts) >= max_items:
                    break

                url = "https://www.reddit.com/search/?" + urllib.parse.urlencode({"q": query, "type": "link"})
                print(f"Cerco Reddit con browser locale: {query}")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    sleep_like_a_person(4.0, 6.0)
                    body = page.locator("body").inner_text(timeout=12000)
                except Exception as error:
                    print(f"Reddit browser search non disponibile ({error}).")
                    continue

                if "You've been blocked by network security" in body or "Access Denied" in body:
                    print("Reddit ha bloccato la pagina browser; passo al fallback testuale/API.")
                    break

                items = page.evaluate(
                    """() => Array.from(document.querySelectorAll('a[href*="/comments/"]')).map((anchor) => {
                      let node = anchor;
                      let bestText = "";
                      for (let i = 0; i < 8 && node; i += 1) {
                        const text = (node.innerText || node.textContent || "").trim();
                        if (text.length > bestText.length && text.length < 1800) bestText = text;
                        node = node.parentElement;
                      }
                      return {
                        href: anchor.href,
                        title: (anchor.innerText || anchor.textContent || "").trim(),
                        text: bestText,
                      };
                    })"""
                )

                for item in items:
                    if len(excerpts) >= max_items:
                        break

                    reddit_url = clean_text(item.get("href"), 400)
                    if not reddit_url or reddit_url in seen_urls:
                        continue

                    title = clean_text(item.get("title"), 220)
                    text = clean_text(item.get("text"), 1200)
                    content = clean_text(text if len(text) > len(title) + 20 else title, 1000)
                    if len(content) < 45:
                        continue

                    relevant, score, reason = text_relevance_score(topic_focus, content[:700], 0.18)
                    if not relevant:
                        print(f"Scarto Reddit browser poco pertinente ({reason}): {content[:80]}")
                        continue
                    if not re.search(
                        r"\b(guide|recommend|recommendation|advice|trip|plan|planning|itinerary|tips?|review|help|question|visit|hike|route|stay|mistakes?|first time)\b",
                        content,
                        re.I,
                    ):
                        print(f"Scarto Reddit browser senza intento utile: {content[:80]}")
                        continue

                    subreddit_match = re.search(r"\br/([A-Za-z0-9_]+)\b", content)
                    votes_match = re.search(r"([\d,.]+K?)\s+votes?", content, re.I)
                    comments_match = re.search(r"([\d,.]+K?)\s+comments?", content, re.I)

                    def parse_compact_count(value: str) -> int:
                        cleaned = value.replace(",", "").strip().lower()
                        if cleaned.endswith("k"):
                            return int(float(cleaned[:-1]) * 1000)
                        return parse_int(cleaned)

                    upvotes = parse_compact_count(votes_match.group(1)) if votes_match else 0
                    comments = parse_compact_count(comments_match.group(1)) if comments_match else 0
                    subreddit = subreddit_match.group(1) if subreddit_match else ""
                    thread_comments: list[str] = []

                    if len(excerpts) < 5:
                        try:
                            page.goto(reddit_url, wait_until="domcontentloaded", timeout=45000)
                            sleep_like_a_person(3.5, 5.5)
                            comment_texts = page.evaluate(
                                """() => Array.from(document.querySelectorAll('shreddit-comment, [data-testid="comment"]'))
                                  .map((node) => (node.innerText || node.textContent || "").trim())
                                  .filter(Boolean)
                                  .slice(0, 12)"""
                            )
                            seen_comment_keys: set[str] = set()
                            for comment_text in comment_texts:
                                cleaned_comment = clean_text(comment_text, 650)
                                cleaned_comment = re.sub(r"\b\d+\s+more replies\b", "", cleaned_comment, flags=re.I).strip()
                                if len(cleaned_comment) < 80:
                                    continue
                                comment_key = cleaned_comment[:90].lower()
                                if comment_key in seen_comment_keys:
                                    continue
                                comment_relevant, _comment_score, _comment_reason = text_relevance_score(topic_focus, cleaned_comment[:600], 0.12)
                                if not comment_relevant and not re.search(r"\b(trail|hike|stay|parking|permit|reservation|bear|shuttle|itinerary|drive|lake|pass)\b", cleaned_comment, re.I):
                                    continue
                                seen_comment_keys.add(comment_key)
                                thread_comments.append(cleaned_comment)
                                if len(thread_comments) >= 3:
                                    break
                        except Exception as error:
                            print(f"Commenti Reddit non disponibili per {reddit_url[:90]} ({error}).")

                    comment_block = "\nTop visible comments:\n- " + "\n- ".join(thread_comments) if thread_comments else ""
                    enriched_content = clean_text(f"{content}{comment_block}", 1400)

                    seen_urls.add(reddit_url)
                    sources.append(reddit_url)
                    raw_parts.append(
                        f"=== REAL REDDIT BROWSER RESULT ({reddit_url}) ===\n"
                        f"Subreddit: r/{subreddit} | Upvotes: {upvotes} | Comments: {comments}\n"
                        f"{enriched_content}"
                    )
                    excerpts.append(
                        {
                            "content": enriched_content[:1000],
                            "source": "Reddit",
                            "url": reddit_url,
                            "upvotes": upvotes,
                            "comments": comments,
                            "relevanceScore": min(100, 60 + round(score * 35) + min(10, comments // 10)),
                            "subreddit": subreddit,
                        }
                    )

                sleep_like_a_person(1.0, 2.5)
        finally:
            browser.close()

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def extract_quora_urls_from_search_html(html: str) -> list[str]:
    urls: list[str] = []

    for raw_url in re.findall(r"https?://[^\"'<>\\\s]+", html):
        decoded = unescape(raw_url)
        if "uddg=" in decoded:
            parsed = urllib.parse.urlparse(decoded)
            query = urllib.parse.parse_qs(parsed.query)
            decoded = query.get("uddg", [decoded])[0]
        decoded = urllib.parse.unquote(decoded)
        decoded = decoded.split("&")[0]

        if "quora.com" not in decoded.lower():
            continue
        if any(skip in decoded.lower() for skip in ["/profile/", "/topic/", "/search?", "bing.com/search"]):
            continue

        decoded = decoded.rstrip("/")
        if decoded not in urls:
            urls.append(decoded)

    return urls[:10]


def extract_search_result_snippets(html: str, niche: str, source_name: str, max_items: int) -> tuple[str, list[dict[str, Any]], list[str]]:
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []

    candidates = extract_quora_urls_from_search_html(html)
    plain = strip_html(html, 20000)

    for url in candidates:
        if len(excerpts) >= max_items:
            break

        url_marker = urllib.parse.unquote(url).replace("https://www.", "").replace("https://", "")
        marker_index = plain.lower().find(url_marker[:40].lower())
        window = plain[max(0, marker_index - 500): marker_index + 900] if marker_index >= 0 else plain[:1400]
        window = clean_text(window, 900)

        # Search result pages sometimes omit the visible URL near the snippet. Keep
        # only text that is clearly relevant in the lead, otherwise skip it.
        relevant, score, reason = text_relevance_score(niche, window[:600], 0.25)
        if not relevant:
            print(f"Scarto {source_name} snippet poco pertinente ({reason}): {window[:80]}")
            continue

        content = window
        if len(content) < 45:
            continue

        sources.append(url)
        raw_parts.append(f"=== REAL QUORA SEARCH RESULT ({url}) ===\n{content}")
        excerpts.append(
            {
                "content": content[:500],
                "source": "Quora",
                "url": url,
                "relevanceScore": min(100, 55 + round(score * 35)),
            }
        )

    return "\n\n".join(raw_parts), excerpts, list(dict.fromkeys(sources))


def scrape_quora_public(niche: str, max_items: int = 8) -> tuple[str, list[dict[str, Any]], list[str]]:
    topic_queries = derive_topic_queries(niche)
    queries = [
        f'site:quora.com "{topic_queries[0]}"',
        *[f"site:quora.com {query}" for query in topic_queries[1:5]],
    ]
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_urls: set[str] = set()

    for query in queries:
        if len(excerpts) >= max_items:
            break

        print(f"Cerco Quora pubblico: {query}")
        search_html = ""
        search_sources = [
            ("Bing", "https://www.bing.com/search?" + urllib.parse.urlencode({"q": query})),
            ("DuckDuckGo", "https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query})),
        ]

        for source_name, search_url in search_sources:
            if len(excerpts) >= max_items:
                break
            try:
                search_html = fetch_url(search_url, timeout=20)
                raw, found_excerpts, found_sources = extract_search_result_snippets(
                    search_html,
                    niche,
                    source_name,
                    max_items - len(excerpts),
                )
                for excerpt in found_excerpts:
                    if excerpt["url"] in seen_urls:
                        continue

                    # Try direct Quora fetch. If blocked, keep the search snippet
                    # as a verified short excerpt with the Quora URL.
                    try:
                        quora_html = fetch_url(excerpt["url"], timeout=12)
                        page_text = strip_html(quora_html, 1800)
                        relevant, score, reason = text_relevance_score(niche, page_text[:800], 0.25)
                        if relevant and len(page_text) >= 80:
                            excerpt["content"] = page_text[:500]
                            excerpt["relevanceScore"] = min(100, 60 + round(score * 35))
                            raw_parts.append(f"=== REAL QUORA PAGE ({excerpt['url']}) ===\n{page_text[:1200]}")
                        else:
                            print(f"Pagina Quora poco pertinente ({reason}); uso snippet fonte ricerca.")
                            if raw:
                                raw_parts.append(raw)
                    except Exception as error:
                        print(f"Quora diretto non disponibile ({error}); uso snippet fonte ricerca.")
                        if raw:
                            raw_parts.append(raw)

                    seen_urls.add(excerpt["url"])
                    excerpts.append(excerpt)

                sources.extend(found_sources)
            except Exception as error:
                print(f"{source_name} Quora search non disponibile ({error}).")

        sleep_like_a_person(1.0, 2.5)

    return "\n\n".join(raw_parts), excerpts[:max_items], list(dict.fromkeys(sources))


def scrape_youtube_api(niche: str, max_items: int = 12) -> tuple[str, list[dict[str, Any]], list[str]]:
    env = {**load_env_file(ROOT / ".env"), **os.environ}
    api_key = env.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        print("YOUTUBE_API_KEY assente: salto YouTube API.")
        return "", [], []

    topic_queries = derive_topic_queries(niche)
    queries = [topic_queries[1] if len(topic_queries) > 1 else niche, topic_queries[0], *topic_queries[2:4]]
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_video_ids: set[str] = set()

    for query in queries:
        if len(excerpts) >= max_items:
            break

        print(f"Cerco YouTube API: {query}")
        search_url = "https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode(
            {
                "key": api_key,
                "part": "snippet",
                "q": query,
                "type": "video",
                "regionCode": "US",
                "relevanceLanguage": "en",
                "safeSearch": "none",
                "maxResults": 6,
                "order": "relevance",
                "fields": "items(id/videoId,snippet(title,description,channelTitle,publishedAt))",
            }
        )

        try:
            search_payload = fetch_json(search_url, timeout=20)
        except Exception as error:
            print(f"YouTube API search non disponibile ({error}).")
            continue

        videos = []
        for item in search_payload.get("items", []):
            video_id = ((item.get("id") or {}).get("videoId") or "").strip()
            if not video_id or video_id in seen_video_ids:
                continue
            snippet = item.get("snippet") or {}
            title = clean_text(snippet.get("title"), 220)
            description = clean_text(snippet.get("description"), 700)
            content = clean_text(f"{title}. {description}" if description else title, 900)
            relevant, score, reason = text_relevance_score(niche, content, 0.18)
            if not relevant:
                print(f"Scarto YouTube API poco pertinente ({reason}): {content[:80]}")
                continue
            seen_video_ids.add(video_id)
            videos.append(
                {
                    "videoId": video_id,
                    "title": title,
                    "description": description,
                    "channel": clean_text(snippet.get("channelTitle"), 140),
                    "publishedAt": snippet.get("publishedAt") or "",
                    "relevanceScore": min(100, 60 + round(score * 35)),
                }
            )

        if not videos:
            continue

        stats_by_video: dict[str, dict[str, Any]] = {}
        stats_url = "https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode(
            {
                "key": api_key,
                "part": "statistics",
                "id": ",".join(video["videoId"] for video in videos),
                "fields": "items(id,statistics(viewCount,likeCount,commentCount))",
            }
        )
        try:
            stats_payload = fetch_json(stats_url, timeout=20)
            stats_by_video = {
                item.get("id"): item.get("statistics") or {}
                for item in stats_payload.get("items", [])
                if item.get("id")
            }
        except Exception as error:
            print(f"YouTube API stats non disponibili ({error}).")

        for video in videos:
            if len(excerpts) >= max_items:
                break

            video_id = video["videoId"]
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            stats = stats_by_video.get(video_id, {})
            sources.append(video_url)
            raw_parts.append(
                f"=== REAL YOUTUBE API VIDEO ({video_url}) ===\n"
                f"Channel: {video['channel']} | Views: {stats.get('viewCount', 'N/A')} | Comments: {stats.get('commentCount', 'N/A')}\n"
                f"{video['title']}. {video['description']}"
            )

            comments_url = "https://www.googleapis.com/youtube/v3/commentThreads?" + urllib.parse.urlencode(
                {
                    "key": api_key,
                    "part": "snippet",
                    "videoId": video_id,
                    "maxResults": 20,
                    "order": "relevance",
                    "textFormat": "plainText",
                    "fields": "items(snippet/topLevelComment/snippet(textDisplay,authorDisplayName,likeCount,publishedAt))",
                }
            )
            try:
                comments_payload = fetch_json(comments_url, timeout=20)
                comments = comments_payload.get("items", [])
            except Exception as error:
                print(f"Commenti YouTube API non disponibili per {video_url} ({error}).")
                comments = []

            comment_added = False
            for comment_item in comments:
                if len(excerpts) >= max_items:
                    break
                snippet = (((comment_item.get("snippet") or {}).get("topLevelComment") or {}).get("snippet") or {})
                comment_text = clean_text(snippet.get("textDisplay"), 900)
                if len(comment_text) < 35:
                    continue
                relevant, comment_score, reason = text_relevance_score(niche, f"{video['title']} {comment_text}", 0.16)
                if not relevant:
                    print(f"Scarto commento YouTube poco pertinente ({reason}): {comment_text[:80]}")
                    continue
                like_count = int(snippet.get("likeCount") or 0)
                content = clean_text(f"{video['title']} — {comment_text}", 1000)
                raw_parts.append(
                    f"=== REAL YOUTUBE COMMENT ({video_url}) ===\n"
                    f"Video: {video['title']} | Channel: {video['channel']} | Likes: {like_count}\n"
                    f"{comment_text}"
                )
                excerpts.append(
                    {
                        "content": content[:700],
                        "source": "YouTube",
                        "url": video_url,
                        "upvotes": like_count,
                        "comments": parse_int(stats.get("commentCount")),
                        "relevanceScore": min(100, max(video["relevanceScore"], 58 + round(comment_score * 35) + min(8, like_count))),
                        "author": clean_text(snippet.get("authorDisplayName"), 120) or video["channel"],
                        "datePosted": snippet.get("publishedAt") or video["publishedAt"],
                    }
                )
                comment_added = True

            if not comment_added and len(excerpts) < max_items:
                excerpts.append(
                    {
                        "content": clean_text(f"{video['title']}. {video['description']}", 700),
                        "source": "YouTube",
                        "url": video_url,
                        "upvotes": parse_int(stats.get("likeCount")),
                        "comments": parse_int(stats.get("commentCount")),
                        "relevanceScore": video["relevanceScore"],
                        "author": video["channel"],
                        "datePosted": video["publishedAt"],
                    }
                )

        sleep_like_a_person(0.4, 1.0)

    return "\n\n".join(raw_parts), excerpts[:max_items], list(dict.fromkeys(sources))


def scrape_youtube_public(niche: str, max_items: int = 8) -> tuple[str, list[dict[str, Any]], list[str]]:
    raw_parts: list[str] = []
    excerpts: list[dict[str, Any]] = []
    sources: list[str] = []
    seen_video_ids: set[str] = set()

    for query in derive_topic_queries(niche)[:5]:
        if len(excerpts) >= max_items:
            break

        url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query})
        print(f"Cerco YouTube pubblico: {query}")
        try:
            html = fetch_url(url, timeout=25)
        except Exception as error:
            print(f"YouTube search non disponibile ({error}).")
            continue

        renderers: list[dict[str, Any]] = []
        data_match = re.search(r"ytInitialData\s*=\s*(\{[\s\S]*?\});", html)
        if data_match:
            try:
                initial_data = json.loads(data_match.group(1))

                def collect_video_renderers(value: Any) -> None:
                    if isinstance(value, dict):
                        renderer = value.get("videoRenderer")
                        if isinstance(renderer, dict):
                            renderers.append(renderer)
                        for child_value in value.values():
                            collect_video_renderers(child_value)
                    elif isinstance(value, list):
                        for child_value in value:
                            collect_video_renderers(child_value)

                collect_video_renderers(initial_data)
            except Exception as error:
                print(f"Parsing YouTube strutturato non disponibile ({error}); uso fallback leggero.")

        if not renderers:
            blocks = re.findall(r'"videoRenderer":\{([\s\S]*?)\}\s*,\s*"\w+Renderer"', html)
            for block in blocks:
                video_match = re.search(r'"videoId":"([^"]+)"', block)
                title_match = re.search(r'"title":\{"runs":\[\{"text":"([^"]+)"', block)
                if video_match and title_match:
                    renderers.append(
                        {
                            "videoId": video_match.group(1),
                            "title": {"runs": [{"text": title_match.group(1)}]},
                            "ownerText": {"runs": [{"text": clean_text(re.search(r'"ownerText":\{"runs":\[\{"text":"([^"]+)"', block).group(1), 120) if re.search(r'"ownerText":\{"runs":\[\{"text":"([^"]+)"', block) else ""}]},
                        }
                    )

        for renderer in renderers:
            if len(excerpts) >= max_items:
                break
            video_id = renderer.get("videoId") or ""
            title_runs = renderer.get("title", {}).get("runs", [])
            if not video_id or not title_runs:
                continue
            if video_id in seen_video_ids:
                continue

            title = clean_text(" ".join(run.get("text", "") for run in title_runs if isinstance(run, dict)), 220)
            owner_runs = renderer.get("ownerText", {}).get("runs", [])
            channel = clean_text(" ".join(run.get("text", "") for run in owner_runs if isinstance(run, dict)), 120)
            snippets = renderer.get("detailedMetadataSnippets") or []
            description_parts: list[str] = []
            for snippet in snippets[:2]:
                runs = snippet.get("snippetText", {}).get("runs", []) if isinstance(snippet, dict) else []
                description_parts.extend(run.get("text", "") for run in runs if isinstance(run, dict))
            description = clean_text(" ".join(description_parts), 500)
            content = clean_text(f"{title}. {description}" if description else title, 700)
            relevant, score, reason = text_relevance_score(niche, content, 0.18)
            if not relevant:
                print(f"Scarto YouTube poco pertinente ({reason}): {content[:80]}")
                continue

            video_url = f"https://www.youtube.com/watch?v={video_id}"
            seen_video_ids.add(video_id)
            sources.append(video_url)
            raw_parts.append(f"=== PUBLIC YOUTUBE VIDEO ({video_url}) ===\nChannel: {channel}\n{content}")
            excerpts.append(
                {
                    "content": content[:500],
                    "source": "YouTube",
                    "url": video_url,
                    "relevanceScore": min(100, 60 + round(score * 35)),
                    "author": channel,
                }
            )

        sleep_like_a_person(1.0, 2.0)

    return "\n\n".join(raw_parts), excerpts[:max_items], list(dict.fromkeys(sources))


def save_payload(
    niche: str,
    books: list[dict[str, Any]],
    amazon_reviews: list[str],
    social_content: str,
    social_excerpts: list[dict[str, Any]],
    social_sources: list[str],
    google_trends: dict[str, Any] | None = None,
) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", niche.lower()).strip("-") or "niche"
    output_path = OUTPUT_DIR / f"{slug}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    payload = {
        "niche": niche,
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "source": "personal-amazon-playwright",
        "marketplace": "amazon.com",
        "market": "US",
        "books": books,
        "booksWithBsr": len([book for book in books if int(book.get("bsr") or 0) > 0]),
        "amazonReviews": amazon_reviews,
        "socialContent": social_content,
        "socialExcerpts": social_excerpts,
        "socialSources": social_sources,
        "googleTrends": google_trends,
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return output_path


def submit_to_kdpintel(
    niche: str,
    books: list[dict[str, Any]],
    amazon_reviews: list[str],
    social_content: str,
    social_excerpts: list[dict[str, Any]],
    social_sources: list[str],
    google_trends: dict[str, Any] | None = None,
    max_attempts: int = 5,
) -> dict[str, Any]:
    env = {**load_env_file(ROOT / ".env"), **os.environ}
    supabase_url = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
    anon_key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("VITE_SUPABASE_ANON_KEY")

    if not supabase_url or not anon_key:
        raise RuntimeError("Mancano VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY nel file .env.")

    ssl_context = ssl.create_default_context(cafile=certifi.where())
    last_error = ""

    for attempt in range(1, max_attempts + 1):
        request = urllib.request.Request(
            f"{supabase_url.rstrip('/')}/functions/v1/analyze-niche",
            data=json.dumps(
                {
                    "niche": niche,
                    "localBooks": books,
                    "localAmazonReviews": amazon_reviews,
                    "localSocialContent": social_content,
                    "localSocialExcerpts": social_excerpts,
                    "localSocialSources": social_sources,
                    "localGoogleTrends": google_trends,
                }
            ).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {anon_key}",
                "apikey": anon_key,
            },
            method="POST",
        )

        try:
            print(f"Invio dati verificati a Supabase: tentativo {attempt}/{max_attempts}")
            with urllib.request.urlopen(request, timeout=45, context=ssl_context) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if payload.get("success") is False:
                    last_error = json.dumps(payload, ensure_ascii=False)
                    raise RuntimeError(last_error)
                return payload
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            last_error = f"HTTP {error.code}: {body[-1200:]}"
        except URLError as error:
            last_error = f"Errore rete/SSL: {error.reason}"
        except Exception as error:
            last_error = str(error)

        if attempt < max_attempts:
            wait_seconds = min(20, 2 * attempt)
            print(f"Invio non riuscito: {last_error}")
            print(f"Riprovo tra {wait_seconds}s senza perdere i dati raccolti.")
            time.sleep(wait_seconds)

    raise RuntimeError(f"Invio a Supabase non riuscito dopo {max_attempts} tentativi. Ultimo errore: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Personal Amazon KDP scraper for KDPIntel.")
    parser.add_argument("niche", help="Keyword/niche da analizzare")
    parser.add_argument("--max-books", type=int, default=8, help="Numero massimo di libri da leggere")
    parser.add_argument("--min-bsr-books", type=int, default=3, help="Numero minimo di libri con BSR reale richiesto")
    parser.add_argument("--zip-code", default=DEFAULT_US_ZIP_CODE, help="CAP USA usato per prezzi e disponibilita Amazon.com")
    parser.add_argument("--max-reviews-per-book", type=int, default=4, help="Numero massimo di recensioni Amazon da raccogliere per libro")
    parser.add_argument("--skip-social", action="store_true", help="Salta Reddit/social pubblico")
    parser.add_argument("--headful", action="store_true", help="Mostra il browser mentre raccoglie i dati")
    parser.add_argument("--submit", action="store_true", help="Invia i dati raccolti all'analisi KDPIntel")
    args = parser.parse_args()

    if args.max_books < 1 or args.max_books > 20:
        raise SystemExit("--max-books deve essere tra 1 e 20.")
    if args.min_bsr_books < 1 or args.min_bsr_books > args.max_books:
        raise SystemExit("--min-bsr-books deve essere tra 1 e --max-books.")

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
        browser.add_cookies([
            {"name": "i18n-prefs", "value": "USD", "domain": ".amazon.com", "path": "/"},
            {"name": "lc-main", "value": "en_US", "domain": ".amazon.com", "path": "/"},
        ])
        page = browser.new_page()

        amazon_reviews: list[str] = []
        amazon_review_excerpts: list[dict[str, Any]] = []
        amazon_review_sources: list[str] = []

        try:
            set_us_delivery_location(page, args.zip_code)
            candidate_limit = max(args.max_books * 4, 24)
            books = search_books(page, args.niche, candidate_limit)
            print(f"Trovati {len(books)} candidati. Ora leggo le schede prodotto.")

            enriched: list[dict[str, Any]] = []
            for book in books:
                if len(enriched) >= args.max_books:
                    break
                try:
                    enriched_book = enrich_book_detail(page, book)
                    if not is_title_relevant(args.niche, enriched_book.get("title", "")):
                        print(f"Scarto dopo verifica per bassa pertinenza: {book['asin']} - {book['title'][:70]}")
                        continue
                    if int(enriched_book.get("bsr") or 0) > 0:
                        enriched.append(enriched_book)
                        print(f"BSR valido raccolto: {len(enriched)}/{args.min_bsr_books} minimo, {args.max_books} massimo")
                    else:
                        print(f"Scarto senza BSR: {book['asin']} - {book['title'][:70]}")
                except Exception as error:
                        print(f"Errore su {book['asin']}: {error}")
                sleep_like_a_person(3.0, 7.0)

            if enriched:
                amazon_reviews, amazon_review_excerpts, amazon_review_sources = scrape_amazon_reviews(
                    page,
                    args.niche,
                    enriched,
                    max(1, min(args.max_reviews_per_book, 8)),
                )
        finally:
            browser.close()

    reddit_content = ""
    reddit_excerpts: list[dict[str, Any]] = []
    reddit_sources: list[str] = []
    quora_content = ""
    quora_excerpts: list[dict[str, Any]] = []
    quora_sources: list[str] = []
    youtube_content = ""
    youtube_excerpts: list[dict[str, Any]] = []
    youtube_sources: list[str] = []
    public_content = ""
    public_excerpts: list[dict[str, Any]] = []
    public_sources: list[str] = []
    google_trends: dict[str, Any] | None = None
    if not args.skip_social:
        try:
            reddit_content, reddit_excerpts, reddit_sources = scrape_reddit_praw(args.niche)
        except Exception as error:
            print(f"Reddit API non disponibile ({error}); passo al browser.")

        if len(reddit_excerpts) < 3:
            try:
                browser_content, browser_excerpts, browser_sources = scrape_reddit_with_browser(args.niche)
                known_reddit_urls = {item.get("url") for item in reddit_excerpts}
                reddit_content = "\n\n".join(part for part in [reddit_content, browser_content] if part)
                reddit_excerpts.extend(item for item in browser_excerpts if item.get("url") not in known_reddit_urls)
                reddit_sources = list(dict.fromkeys(reddit_sources + browser_sources))
            except Exception as error:
                print(f"Reddit browser non disponibile ({error}); passo al fallback pubblico.")

        if len(reddit_excerpts) < 6:
            fallback_content, fallback_excerpts, fallback_sources = scrape_reddit_public(args.niche)
            known_reddit_urls = {item.get("url") for item in reddit_excerpts}
            reddit_content = "\n\n".join(part for part in [reddit_content, fallback_content] if part)
            reddit_excerpts.extend(item for item in fallback_excerpts if item.get("url") not in known_reddit_urls)
            reddit_sources = list(dict.fromkeys(reddit_sources + fallback_sources))

        try:
            reddit_excerpts.sort(
                key=lambda item: (
                    int(item.get("relevanceScore") or 0),
                    int(item.get("upvotes") or 0),
                    int(item.get("comments") or 0),
                ),
                reverse=True,
            )
        except Exception as error:
            print(f"Ordinamento Reddit non riuscito ({error}).")

        quora_content, quora_excerpts, quora_sources = scrape_quora_public(args.niche)
        youtube_content, youtube_excerpts, youtube_sources = scrape_youtube_api(args.niche)
        if len(youtube_excerpts) < 4:
            fallback_youtube_content, fallback_youtube_excerpts, fallback_youtube_sources = scrape_youtube_public(args.niche)
            known_youtube_urls = {item.get("url") for item in youtube_excerpts}
            youtube_content = "\n\n".join(part for part in [youtube_content, fallback_youtube_content] if part)
            youtube_excerpts.extend(item for item in fallback_youtube_excerpts if item.get("url") not in known_youtube_urls)
            youtube_sources = list(dict.fromkeys(youtube_sources + fallback_youtube_sources))
        public_content, public_excerpts, public_sources = scrape_public_web_signals(args.niche)
        google_trends = scrape_google_trends_pytrends(args.niche)

    existing_urls = {item.get("url") for item in amazon_review_excerpts + reddit_excerpts + quora_excerpts + youtube_excerpts}
    deduped_public_excerpts = [item for item in public_excerpts if item.get("url") not in existing_urls]

    social_content = "\n\n".join(part for part in [reddit_content, quora_content, youtube_content, public_content] if part)
    social_excerpts = amazon_review_excerpts + reddit_excerpts + quora_excerpts + youtube_excerpts + deduped_public_excerpts
    social_sources = list(dict.fromkeys(amazon_review_sources + reddit_sources + quora_sources + youtube_sources + public_sources))

    output_path = save_payload(args.niche, enriched, amazon_reviews, social_content, social_excerpts, social_sources, google_trends)
    print(f"Salvato: {output_path}")
    print(f"Libri con BSR reale: {len(enriched)}")
    print(f"Recensioni Amazon reali raccolte: {len(amazon_reviews)}")
    print(f"Discussioni Reddit reali raccolte: {len(reddit_excerpts)}")
    print(f"Excerpt Quora reali/snippet verificabili raccolti: {len(quora_excerpts)}")
    print(f"Segnali YouTube pubblici raccolti: {len(youtube_excerpts)}")
    print(f"Segnali web pubblici aggiuntivi raccolti: {len(deduped_public_excerpts)}")
    print(f"Google Trends locale: {'presente' if google_trends else 'non disponibile'}")

    if len(enriched) < args.min_bsr_books:
        raise SystemExit(
            f"Solo {len(enriched)} libri con BSR reale trovati. "
            f"Minimo richiesto: {args.min_bsr_books}. "
            "Riprova piu' tardi o con una keyword leggermente piu' ampia."
        )

    if args.submit:
        result = submit_to_kdpintel(args.niche, enriched, amazon_reviews, social_content, social_excerpts, social_sources, google_trends)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
