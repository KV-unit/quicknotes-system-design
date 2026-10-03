# QuickNotes Architecture

## Functional Requirements

* Users can register and log in.
* Users can create, read, update, and delete their own notes.
* Users can attach and remove tags on notes.
* Users can list and filter their notes.

## Non-Functional Requirements

* Support 1,000,000 registered users.
* Read endpoints (`GET /notes`) should respond in under 200ms at the 95th percentile.
* The system should be available 99.9% of the time.
* Note data must be durable — a single server failure must not lose data.
* The system should scale horizontally as usage grows, rather than requiring bigger single machines.

## Load Estimate (1,000,000 Users)

**Assumptions:**

* Total registered users: 1,000,000
* Daily Active Users (DAU): 20% → **200,000 DAU**
* Notes created per active user per day: 2
* Notes-list views (`GET /notes`) per active user per day: 20
* Average note size (title + body): ~1 KB
* Time calculation: a day of 100,000 seconds (a common rounding trick, slightly larger than the actual 86,400 seconds)

**Writes (`POST /notes`):**

* Writes per day = 200,000 × 2 = 400,000 writes/day
* Writes per second (average) = 400,000 ÷ 100,000 = **4 writes/sec**
* Peak (5x average) = **20 writes/sec**

**Reads (`GET /notes`):**

* Reads per day = 200,000 × 20 = 4,000,000 reads/day
* Reads per second (average) = 4,000,000 ÷ 100,000 = **40 reads/sec**
* Peak (5x average) = **200 reads/sec**

This is a **10:1 read-to-write ratio** — read-heavy, though less extreme than an image-heavy app, since notes are small text records. It still justifies a cache and a read replica: without them, every one of those 40-200 reads/sec would hit the primary database directly, competing with writes.

**Storage per year:**

* Daily storage = 400,000 notes/day × 1 KB = 400,000 KB/day ≈ 390.6 MB/day
* Yearly storage = 390.6 MB × 365 ≈ 142,578 MB/year ≈ **139.2 GB/year** (≈ 0.14 TB/year)

Notes are plain text, so this is small compared to an image-heavy app — no object storage or CDN-for-media is needed for the notes themselves. The CDN here instead serves the static front-end assets.

## Component Explanations

* **DNS:** Resolves the app's domain name to the CDN/load balancer so clients know where to send requests.
* **CDN Edge:** Caches and serves the static front-end files (`index.html`, `api.js`, `style.css`) from locations close to the user, cutting latency and load on the origin for every page load.
* **Load Balancer:** Distributes incoming API requests across multiple stateless App Servers, so no single server becomes a bottleneck or a single point of failure.
* **App Servers (Stateless):** Handle request validation, authentication, and business logic; being stateless lets any instance handle any request, so instances can be added or removed freely as load changes.
* **Cache (Redis):** Stores recently requested `GET /notes` results in memory so repeated reads for the same user don't have to hit the database every time.
* **Database (Primary):** The single source of truth for all writes (`POST`, `PUT`, `DELETE`), keeping data consistent and durable.
* **Read Replica:** Takes read traffic off the primary database by serving `GET /notes` queries on a cache miss, so the heavy read volume doesn't compete with writes.
* **Queue (Redis/SQS):** Decouples slow background work (search indexing, email notifications) from the request/response cycle, so the API can respond as soon as the note is saved.
* **Worker Servers:** Consume jobs from the queue to send emails and update the search index after a note is created or updated, without blocking the user's request.

## Architecture Diagram

```text
                              [ Client (Browser) ]
                                       |
                                       v
                                   [ DNS ]
                                       |
                                       v
                                 [ CDN Edge ]
                      (caches index.html, api.js, style.css)
                                       |
                                       v
                               [ Load Balancer ]
                                 /            \
                                v              v
                      [ App Server 1 ]   [ App Server 2 ]
                                 \              /
                     (Read notes) \            / (Write / delete notes)
                                   v          v
                          [ Cache (Redis) ]   [ Database (Primary) ]
                                 ^                   |        \
                                 |                   |         \
                     (cache miss:       (Async Replication)   (enqueue background job)
                      read-through)                  |           \
                                 |                   v             v
                                 +----------- [ Read Replica ]   [ Queue (Redis/SQS) ]
                                                                        |
                                                                        v
                                                              [ Worker Servers ]
                                                          (send emails, update
                                                        search index after writes)
```

**Diagram notes:**

* `App Servers → Cache` is checked first for `GET /notes`. On a cache miss, the App Server reads from the `Read Replica` (the line looping back up into `Cache`) and populates the cache with the result.
* `App Servers → Database (Primary)` handles all writes (`POST`, `PUT`, `DELETE /notes`).
* `Database (Primary) → Read Replica` is the asynchronous replication stream that keeps the replica in sync, separate from the direct read-through path above.
* `App Servers → Queue → Worker Servers` is the decoupled background pipeline for search indexing and notifications, so those slower tasks never block the API response.

## Request Flows

### `GET /notes`

1. Client sends `GET /notes` with an auth token; DNS resolves the domain to the CDN/load balancer.
2. The Load Balancer routes the request to an available App Server.
3. The App Server checks the Cache for a cached notes list for this user.
4. **Cache hit:** the App Server returns the cached list immediately.
5. **Cache miss:** the App Server queries the Read Replica for the user's notes.
6. The App Server stores the result in the Cache (with a short TTL) and returns it to the client.

### `POST /notes`

1. Client sends `POST /notes` with the note payload and auth token.
2. The Load Balancer routes the request to an App Server.
3. The App Server validates the payload (title required, ≤ 100 characters, user authenticated).
4. The App Server writes the new note to the Database (Primary).
5. The App Server invalidates the cached notes list for this user, so the next `GET /notes` reflects the change instead of serving stale cached data.
6. The App Server enqueues a background job onto the Queue (e.g., update the search index).
7. The App Server returns `201 Created` with the new note to the client.
8. A Worker later picks the job off the Queue and completes the background work.

## Trade-offs

**Cache staleness vs. read scalability.** Caching `GET /notes` responses means a user could briefly see an outdated list if a write happens in another tab or device right before a cached read is served. We accept this because it dramatically cuts read load on the database — without it, every one of the ~40-200 reads/sec at peak would hit the database directly. We limit the damage by invalidating the specific cache entry on every write (step 5 above) rather than relying only on a TTL, so staleness is bounded to a narrow race window rather than a full cache lifetime.

**Replication lag vs. read offloading.** Serving reads from a Read Replica instead of the primary offloads the bulk of read traffic, but replication is asynchronous, so a user could theoretically not see their own just-created note if a read were routed to a replica that hasn't caught up yet. We accept this trade-off given the 10:1 read-heavy workload, and mitigate the user-facing symptom by invalidating/repopulating the Cache directly on write (rather than relying on the replica) — so a user's next read is served from the just-updated cache entry, not a lagging replica.

## Single Points of Failure

* **App tier:** two or more App Servers sit behind the Load Balancer with health checks, so one server crashing doesn't take the API down — the Load Balancer simply stops routing to it.
* **Load Balancer:** deployed as a managed/HA pair rather than a single instance, so the balancer itself isn't a single point of failure.
* **Database:** the Read Replica doubles as a promotable standby — if the Primary fails, it can be promoted to take writes, minimizing downtime, backed by regular automated backups for durability.
* **Queue/Workers:** multiple Worker instances consume from the same Queue, so one worker crashing doesn't stop background processing — its in-flight jobs become visible again and get picked up by another worker.
