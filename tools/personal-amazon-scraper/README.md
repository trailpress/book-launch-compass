# Personal Amazon Scraper

Questo e' uno scraper locale per piccoli test personali di KDPIntel.

Non usa Firecrawl, Rainforest o Lovable. Apre Amazon con Playwright sul tuo Mac,
estrae pochi competitor, legge ASIN, prezzo, recensioni, rating e BSR, poi salva
un JSON controllabile.

## Installazione

```bash
cd "/Users/Pippo/Documents/Porting from Lovable/Book Launch Compass"
python3 -m venv .venv-scraper
source .venv-scraper/bin/activate
pip install -r tools/personal-amazon-scraper/requirements.txt
python -m playwright install chromium
```

## Raccolta dati

```bash
python tools/personal-amazon-scraper/scrape_amazon_kdp.py "anxiety workbook" --max-books 8 --headful
```

Il file viene salvato in:

```text
tools/personal-amazon-scraper/output/
```

## Invio a KDPIntel

Dopo aver controllato il JSON:

```bash
python tools/personal-amazon-scraper/scrape_amazon_kdp.py "anxiety workbook" --max-books 8 --headful --submit
```

Se Amazon mostra captcha o blocchi, lo scraper si ferma. Per uso personale va
tenuto lento e con pochi risultati.
