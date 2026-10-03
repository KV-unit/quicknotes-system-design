# QuickNotes System Design

## Description

QuickNotes is a two-part exercise: a browser-based API client that demonstrates GET, POST, and DELETE against a real REST API (using [JSONPlaceholder](https://jsonplaceholder.typicode.com/) as a practice backend), and a set of system design documents sketching how the real QuickNotes backend would be built to serve 1,000,000 users.

## How to Run the API Client

1. Clone this repository:
   ```
   git clone https://github.com/<your-username>/quicknotes-system-design.git
   cd quicknotes-system-design
   ```
2. Open `index.html` directly in your browser, or serve it locally (recommended, to avoid any `file://` quirks):
   ```
   npx serve .
   ```
   then visit the printed local URL.
3. Click **Load notes** to fetch notes from JSONPlaceholder, use the form to create a note, and use each note's **Delete** button to remove it.

> **Note:** JSONPlaceholder is a mock API — `POST` and `DELETE` requests return realistic responses but don't actually persist changes server-side. The app treats those responses as confirmation the same way it would with a real API; this is explained in code comments in `api.js`.

## Documentation

* [API Design](docs/api-design.md) — the real QuickNotes REST API the backend team would build.
* [Data Model](docs/data-model.md) — the database schema, relationships, and the SQL vs. NoSQL reasoning.
* [Architecture](docs/architecture.md) — load estimates, the system diagram, request flows, and trade-offs for scaling to 1,000,000 users.

## What I Learned

* How to structure a vanilla JS fetch client around a single reusable `request()` helper that checks `response.ok` and throws, instead of repeating error-handling logic for every endpoint.
* How to design a normalized relational schema for a many-to-many relationship (notes and tags) using a join table, and when an index actually earns its place in a schema.
* How trade-offs like cache staleness and replication lag aren't bugs to eliminate but costs to consciously accept in exchange for scalability — and how to mitigate their worst effects, like invalidating a cache entry on write instead of relying on a TTL alone.
