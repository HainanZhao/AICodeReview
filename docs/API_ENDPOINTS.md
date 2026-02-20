# AI Code Review Backend API Endpoints

This document describes the API endpoints provided by the AI Code Review backend server. These endpoints are used by both the Frontend (Web UI) and the AI providers (via the Gemini CLI ACP session).

## Base URL
The default base URL is `http://localhost:5959`.

## Configuration Endpoints

### `POST /api/config`
Retrieves the current GitLab configuration.
- **Used by**: Frontend
- **Response**:
  ```json
  {
    "gitlabUrl": "string",
    "hasAccessToken": boolean,
    "configSource": "string",
    "accessToken": "string (only if CLI config provides it)"
  }
  ```

## Review Endpoints

### `POST /api/review-mr`
Initiates a complete code review for a given Merge Request URL.
- **Used by**: Frontend
- **Request Body**:
  ```json
  {
    "mrUrl": "string",
    "gitlabConfig": {
      "gitlabUrl": "string",
      "accessToken": "string"
    }
  }
  ```
- **Response**:
  ```json
  {
    "feedback": [...],
    "summary": "string",
    "overallRating": "approve|request_changes|comment",
    "mrDetails": {...}
  }
  ```

### `POST /api/chat`
Handles AI chat conversations or line explanations.
- **Used by**: Frontend
- **Request Body**:
  ```json
  {
    "messages": [...],
    "lineContent": "string",
    "filePath": "string",
    "lineNumber": number,
    "fileContent": "string",
    "contextLines": number
  }
  ```
- **Response**: `{ "success": true, "explanation": "string" }`

## GitLab Interaction Endpoints

### `POST /api/post-discussion`
Posts a review comment back to GitLab.
- **Used by**: Frontend
- **Request Body**:
  ```json
  {
    "gitlabConfig": { "url": "string", "accessToken": "string" },
    "mrDetails": {...},
    "feedbackItem": {...}
  }
  ```
- **Response**: `{ "success": true, "result": {...} }`

### `GET /api/files`
A local proxy endpoint that fetches full file content from the GitLab repository for the current MR context.
- **Used by**: Gemini CLI Agent (via ACP tools) and potentially Frontend for deep-dives.
- **Query Parameters**:
  - `path`: (Required) The file path relative to the project root as shown in the MR diff.
- **Response**: Raw file content as `text/plain`.

## Internal AI Agent Interface (Gemini ACP)

The Gemini CLI agent does not call HTTP endpoints directly. Instead, the backend exposes standard file system capabilities to the agent via the ACP JSON-RPC protocol.

### `fs/read_text_file`
When the AI agent requests a file via its built-in tools (e.g., `fs.readTextFile`), the backend intercepts this call and proxies it to the GitLab API using the current Merge Request context.
- **Protocol**: JSON-RPC over stdio (managed by `GeminiACPSession`)
- **Mapping**: `path` argument maps directly to the GitLab repository file path at the MR's head SHA.
