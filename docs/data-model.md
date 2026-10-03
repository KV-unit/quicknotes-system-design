# QuickNotes Data Model

## Entities

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | VARCHAR(100) | Not null |
| `email` | VARCHAR(255) | Unique, not null |
| `password_hash` | TEXT | Not null |
| `created_at` | TIMESTAMP | Not null, defaults to now |

### `notes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key → `users.id` |
| `title` | VARCHAR(100) | Not null |
| `body` | TEXT | Nullable |
| `created_at` | TIMESTAMP | Not null, defaults to now |
| `updated_at` | TIMESTAMP | Not null, defaults to now |

### `tags`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | VARCHAR(50) | Unique, not null |

### `note_tags` (join table)

| Column | Type | Notes |
| --- | --- | --- |
| `note_id` | INTEGER | Foreign key → `notes.id` |
| `tag_id` | INTEGER | Foreign key → `tags.id` |
| | | Composite primary key `(note_id, tag_id)` |

## Relationships

* **`users` → `notes`: one-to-many.** Each note belongs to exactly one user (`notes.user_id`), and a user can have many notes.
* **`notes` ↔ `tags`: many-to-many.** A note can have several tags, and a tag can be applied to many notes. This is modeled with the `note_tags` join table rather than a column on either side, since neither `notes` nor `tags` can hold a variable-length list of foreign keys on its own.

## CREATE TABLE Statements

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(100) NOT NULL,
    body TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
```

## Example Queries

**All notes for a user, most recent first:**

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 14
ORDER BY created_at DESC;
```

**All tags attached to a given note (JOIN):**

```sql
SELECT tags.id, tags.name
FROM tags
JOIN note_tags ON tags.id = note_tags.tag_id
WHERE note_tags.note_id = 482;
```

**Number of notes per user:**

```sql
SELECT user_id, COUNT(*) AS note_count
FROM notes
GROUP BY user_id;
```

## Index

```sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
```

**Reason:** `GET /notes` is the single most frequent query in the system — the app is read-heavy, and every call filters by `user_id`. Without this index, that query degrades to a full table scan as `notes` grows into the millions of rows, directly hurting the API's p95 latency target.

## SQL vs. NoSQL

QuickNotes' data is naturally relational: a note belongs to exactly one user, and notes relate to tags in a many-to-many fashion that benefits from a proper join table and foreign-key constraints to keep referential integrity. The dominant read patterns — filter notes by user, join to the tags on a note — are exactly what a relational database is optimized for. The dataset doesn't need NoSQL's flexible/schemaless documents or its horizontal write scale; a relational database (e.g., PostgreSQL), paired with a read replica for scale, is the better fit for this workload.
