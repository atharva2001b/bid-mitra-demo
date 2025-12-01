# Bid Mitra Frontend - Independent Version

This is an **independent frontend** version of Bid Mitra that runs completely standalone without requiring a backend server. All data is stored locally as JSON files and PDFs are served from the public folder.

## Key Features

- **No Backend Required**: All data is stored locally in JSON files
- **Mock Data**: Uses pre-configured mock data matching ChromaDB structure
- **Demo Chat**: Chat functionality works as a demo with mock search results
- **Local PDFs**: PDF files are served from the `public` folder
- **Preserved Table Values**: All coded table values from `bid-evaluation-data.json` are kept as-is

## Data Structure

The independent frontend uses the following mock data files in the `data/` folder:

- `mock-bids.json` - List of bids (matches ChromaDB bids collection structure)
- `mock-tender.json` - Tender information
- `mock-documents.json` - Document list for chat/search
- `mock-search-results.json` - Mock search results for demo chat functionality
- `bid-evaluation-data.json` - Evaluation data with coded table values (preserved as-is)

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## PDF Files

Place your PDF files in the `public/` folder and reference them in `mock-bids.json` using paths like `/sample-bid.pdf`.

Example:
```json
{
  "pdf_path": "/sample-bid.pdf"
}
```

## Chat Functionality

The chat functionality works as a **demo** with mock search results. When you ask questions in the bid chat:

1. The query is processed with a simulated delay
2. Mock search results are returned (from `mock-search-results.json`)
3. Results show sample pages with financial turnover data for different partners

The mock search results include:
- Page numbers (111, 336, 808)
- Content with HTML tables
- Semantic meanings
- Similarity scores

## Pages Updated for Independent Mode

The following pages have been updated to use local data instead of API calls:

- `/bid-chat` - Chat with bid documents (uses mock search results)
- `/bids` - List of bids (uses `mock-bids.json`)
- `/bids/[id]` - Bid detail page (uses mock data)
- `/dashboard` - Dashboard (uses mock data)
- `/search` - Document search (uses mock search results)

## API Routes

The `/api/bid-evaluation` route still works and reads/writes to `data/bid-evaluation-data.json`. This is the only API route that remains functional for managing evaluation data.

## Mock Data Structure

The mock data matches the exact structure stored in ChromaDB:

### Bids Structure
```json
{
  "bid_id": "f33817e8-a075-4547-8193-e63a2de6d04e",
  "bid_name": "Abhiraj and Shraddha Joint Venture Bid",
  "pdf_path": "/sample-bid.pdf",
  "tender_id": "2581f451-0aca-4562-a8e9-a15791f5439d"
}
```

### Search Results Structure
```json
{
  "document_id": "f33817e8-a075-4547-8193-e63a2de6d04e",
  "page_no": "111",
  "content": "<p>Financial Turnover Data...</p>",
  "semantic_meaning": "This page contains financial turnover data...",
  "similarity_score": 0.15
}
```

## Building for Production

```bash
npm run build
npm start
```

## Differences from Original

1. **No Backend API Calls**: All `API_BASE_URL` fetch calls have been replaced with local JSON imports
2. **Mock Search Results**: Chat and search use pre-configured mock results
3. **Local PDFs**: PDFs are served from `public/` folder instead of backend
4. **Preserved Evaluation Data**: `bid-evaluation-data.json` remains unchanged with all coded values

## Notes

- The chat functionality is a **demo** - it always returns the same mock results regardless of the query
- All table values in `bid-evaluation-data.json` are preserved exactly as they were
- The bid ID and tender ID in mock data match the ones in `bid-evaluation-data.json` for consistency
