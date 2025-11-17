# Bid Mitra - Bid Management System

A modern bid management system built with Next.js and Shadcn UI for managing tenders, bids, and vendor evaluations.

## Features

- **Dashboard**: Overview of tenders, bids, and key metrics
- **Tenders Management**: View and manage tender details
- **Bids Management**: Track and evaluate bids for tenders
- **Tasks**: Task management with filtering and status tracking
- **Vendors**: Vendor management and queries
- **Reports**: Analytics and reporting

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: Shadcn UI
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **TypeScript**: Full type safety

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

## Project Structure

```
app/
├── dashboard/          # Dashboard page
├── tenders/           # Tenders list and detail pages
├── bids/              # Bids list and detail pages
├── tasks/             # Tasks management page
├── vendors/           # Vendors page
├── reports/           # Reports page
└── layout.tsx         # Root layout

components/
├── app-sidebar.tsx    # Main sidebar navigation
├── app-layout.tsx     # App layout wrapper
└── ui/                # Shadcn UI components
```

## Pages

- `/dashboard` - Main dashboard with overview cards
- `/tenders` - List of all tenders
- `/tenders/[id]` - Tender details with summary and bids list
- `/bids` - List of all bids
- `/bids/[id]` - Bid details with AI evaluation
- `/tasks` - Task management
- `/vendors` - Vendor management
- `/reports` - Reports and analytics

## Building for Production

```bash
npm run build
npm start
```

## Theme

The application uses a blue primary color scheme with light backgrounds, matching the design specifications from the provided images.
