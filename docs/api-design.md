# QuickNotes API Design

This document describes the **real QuickNotes API** that the backend team would build — not JSONPlaceholder, which the front-end client in this repo uses only as a stand-in practice API.

Base URL: `https://api.quicknotes.app/v1`

All endpoints except `POST /auth/login` and `POST /users` require a bearer token in the `Authorization` header, obtained from `POST /auth/login`.

## Endpoints

| Method | Path | Description | Success Status |
| --- | --- | --- | --- |
| POST | `/auth/login` | Authenticate a user and return a token | 200 |
| POST | `/users` | Register a new user | 201 |
| GET | `/notes` | List the authenticated user's notes (paginated) | 200 |
| GET | `/notes/{id}` | Get a single note | 200 |
| POST | `/notes` | Create a new note | 201 |
| PUT | `/notes/{id}` | Update an existing note | 200 |
| DELETE | `/notes/{id}` | Delete a note | 204 |
| GET | `/tags` | List all tags | 200 |
| POST | `/notes/{id}/tags` | Attach an existing tag to a note | 201 |
| DELETE | `/notes/{id}/tags/{tag_id}` | Remove a tag from a note | 204 |

## Request / Response Examples

### Create a note — `POST /notes`

Request:

```json
{
  "title": "Groceries",
  "body": "Milk, eggs, bread",
  "tag_ids": [3, 7]
}
```

Response — `201 Created`:

```json
{
  "id": 482,
  "user_id": 14,
  "title": "Groceries",
  "body": "Milk, eggs, bread",
  "tags": [
    { "id": 3, "name": "personal" },
    { "id": 7, "name": "errands" }
  ],
  "created_at": "2026-08-18T09:12:00Z",
  "updated_at": "2026-08-18T09:12:00Z"
}
```

### List notes — `GET /notes?page=1&limit=20`

Response — `200 OK`:

```json
{
  "data": [
    {
      "id": 482,
      "title": "Groceries",
      "body": "Milk, eggs, bread",
      "tags": [{ "id": 3, "name": "personal" }],
      "created_at": "2026-08-18T09:12:00Z",
      "updated_at": "2026-08-18T09:12:00Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 57
}
```

## Error Responses

All errors share the same envelope:

```json
{ "error": { "code": <http_status>, "message": "<human readable message>" } }
```

| Status | When it happens | Example body |
| --- | --- | --- |
| 400 Bad Request | The request payload is invalid, e.g. a missing or too-long title | `{ "error": { "code": 400, "message": "Title is required and must be 100 characters or fewer." } }` |
| 401 Unauthorized | The request is missing a token, or the token is invalid/expired | `{ "error": { "code": 401, "message": "Authentication token is missing or invalid." } }` |
| 403 Forbidden | The user is authenticated but doesn't own the resource they're trying to modify | `{ "error": { "code": 403, "message": "You do not have permission to modify this note." } }` |
| 404 Not Found | The requested note, tag, or user doesn't exist | `{ "error": { "code": 404, "message": "Note with id 482 was not found." } }` |
| 500 Internal Server Error | An unexpected failure on the server | `{ "error": { "code": 500, "message": "Something went wrong on our end. Please try again later." } }` |
