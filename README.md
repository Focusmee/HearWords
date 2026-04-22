# HearWords

HearWords is a local-first English vocabulary learning web app. It helps you import words from text, images, PDF, Word, and Excel files, clean and extract candidates, save them into your own word books, and review them through a lightweight dictation workflow.

The project uses a plain HTML/CSS/JavaScript frontend with a Node.js backend and SQLite storage, so it can run locally without a separate deployment stack.

## Features

- Local-first architecture with Node.js + SQLite
- Import text from manual input, images, PDF, DOCX, and XLSX files
- OCR support powered by `tesseract.js`
- Built-in free English dictionary based on WordNet
- Optional One-API enhanced parsing flow compatible with OpenAI-style chat completions
- Word book management with search, filtering, editing, and export
- Parse history for imported sources and extraction sessions
- Dictation and spaced review workflow based on mastery progress

## Tech Stack

- Frontend: `index.html` + `app.js` + `styles.css`
- Backend: `server.js`
- Database: SQLite via `sqlite3`
- OCR: `tesseract.js`
- Document parsing:
  - PDF via `pdfjs-dist`
  - DOCX/XLSX via ZIP/XML parsing
- Dictionary source: `wordnet-db`

## Project Structure

```text
.
├─ app.js
├─ db.js
├─ document-parsers.js
├─ index.html
├─ server.js
├─ styles.css
├─ text-processing.js
├─ scripts/
│  └─ setup-dictionary.js
├─ docs/
├─ data/
└─ .env.example
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize the dictionary

Import the bundled WordNet dictionary into SQLite:

```bash
npm run setup:dictionary
```

### 3. Start the app

```bash
npm start
```

Open the app in your browser:

```text
http://127.0.0.1:3000
```

### 4. Optional syntax check

```bash
npm run check
```

## Environment Variables

You can create a local `.env` file based on `.env.example`:

```env
HOST=127.0.0.1
PORT=3000
ONE_API_BASE_URL=https://your-one-api.example.com/v1
ONE_API_MODEL=gpt-4o-mini
ONE_API_KEY=sk-xxxx
```

Notes:

- `HOST` and `PORT` control the local server address.
- `ONE_API_*` is optional and only needed if you want enhanced parsing through a compatible LLM gateway.
- Settings can also be adjusted from the app UI and stored locally.

## Supported Inputs

- Plain text pasted into the app
- Images for OCR text extraction
- PDF documents
- Word documents (`.docx`)
- Excel spreadsheets (`.xlsx`)

## Core Workflow

1. Import or paste learning material.
2. Extract text from documents or OCR images.
3. Parse candidate vocabulary items.
4. Review and keep selected entries.
5. Store them in SQLite-backed word books.
6. Practice with dictation and spaced review.

## Data Storage

Application data is stored locally in the `data/` directory, including:

- SQLite database
- local settings
- session and history data

This makes the project convenient for personal use and offline-friendly experimentation.

## Scripts

- `npm start`: start the local server
- `npm run check`: run syntax checks for core JavaScript files
- `npm run setup:dictionary`: import WordNet dictionary data into SQLite

## Current Scope

HearWords is currently designed as a single-user local application. It does not yet include:

- account system
- cloud sync
- multi-user collaboration
- production deployment setup

## Roadmap Ideas

- Better OCR preprocessing for complex images and scanned pages
- More specialized vocabulary sources and import pipelines
- Stronger review analytics and learning progress reporting
- Authentication and cloud synchronization

## License

No license file is included yet. Add a `LICENSE` file before publishing for broader reuse.
