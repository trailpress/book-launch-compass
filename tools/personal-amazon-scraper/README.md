# Personal Amazon Scraper

Questo e' uno scraper locale per piccoli test personali di KDPIntel.

Non usa Firecrawl, Rainforest o Lovable. Apre Amazon con Playwright sul tuo Mac,
estrae pochi competitor, legge ASIN, prezzo, recensioni, rating e BSR, poi salva
un JSON controllabile.

Per coerenza con KDP USA imposta Amazon.com in inglese, valuta USD e CAP USA
predefinito `10001` prima di raccogliere i dati.

## Installazione

```bash
cd "/Users/Pippo/Documents/Porting from Lovable/Book Launch Compass"
python3 -m venv .venv-scraper
source .venv-scraper/bin/activate
pip install -r tools/personal-amazon-scraper/requirements-scraper.txt
python -m playwright install chromium
```

## Raccolta dati

```bash
python tools/personal-amazon-scraper/scrape_amazon_kdp.py "anxiety workbook" --max-books 8 --min-bsr-books 3 --zip-code 10001 --headful
```

Il file viene salvato in:

```text
tools/personal-amazon-scraper/output/
```

## Regola dati verificati

Lo scraper salva solo dati osservati sulla pagina:

- ASIN, titolo, prezzo, rating, recensioni, BSR, pagine e data pubblicazione
  arrivano da Amazon.
- Ogni libro contiene `amazonUrl` e `fieldEvidence`, con il testo grezzo usato
  per leggere i campi principali.
- Se un campo non viene trovato, resta vuoto o a `0`: non viene inventato.
- Vendite, fatturato e profitto non sono dati Amazon osservati: sono calcoli
  derivati dal BSR/prezzo/pagine reali e vanno letti come stime.
- Prima di fallire prova piu' varianti di ricerca Amazon e piu' candidati; per
  default richiede almeno 3 libri con BSR reale.
- Prezzi e disponibilita vengono letti su Amazon.com con CAP USA, di default
  `10001`, e valuta USD.

## Invio a KDPIntel

Dopo aver controllato il JSON:

```bash
python tools/personal-amazon-scraper/scrape_amazon_kdp.py "anxiety workbook" --max-books 8 --min-bsr-books 3 --zip-code 10001 --headful --submit
```

## Uso dall'app

Per far usare lo scraper direttamente al bottone dell'app:

```bash
cd "/Users/Pippo/Documents/Porting from Lovable/Book Launch Compass"
source .venv-scraper/bin/activate
python tools/personal-amazon-scraper/local_scraper_server.py
```

Poi lascia quella finestra aperta e usa l'app su:

```text
http://localhost:8080/
```

Da iPhone, sulla stessa rete, l'app chiamera' il raccoglitore sul Mac usando lo
stesso indirizzo di rete.

Se Amazon mostra captcha o blocchi, lo scraper si ferma. Per uso personale va
tenuto lento e con pochi risultati.
