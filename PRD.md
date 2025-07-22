# Product Requirements Document: Gemini Code Reviewer Full-Stack Transformation

## 1. Introduction

This document outlines the requirements for transforming the Gemini Code Reviewer application from a frontend-only application with direct Gemini API access to a full-stack application. The primary driver for this change is to enhance security by moving sensitive API key handling to a dedicated backend service.

## 2. Goals

*   **Security Enhancement:** Prevent the exposure of the Gemini API key on the client-side by relocating API calls to a secure backend.
*   **Improved Maintainability:** Centralize API interaction logic in a dedicated backend service, making it easier to manage and update.
*   **Scalability (Future):** Lay the groundwork for potential future enhancements that might require more complex server-side logic or integrations.
*   **No User Experience Regression:** Ensure the core functionality and user experience of the code review process remain unchanged from the user's perspective.

## 3. User Stories / Features

### 3.1. Existing Functionality (Unchanged)

*   As a user, I can input a GitLab Merge Request URL to initiate a code review.
*   As a user, I can view the generated code review feedback within the application.
*   As a user, I can interact with the feedback (e.g., post comments to GitLab, edit, ignore).
*   As a user, I can configure GitLab access tokens and URLs.

### 3.2. New (Internal) Functionality

*   As a developer, I can deploy the application with the Gemini API key securely configured on the backend.
*   As a developer, I can manage frontend and backend dependencies and build processes independently.

## 4. Technical Design (High-Level)

### 4.1. Architecture

The application will adopt a client-server architecture:

*   **Frontend:** A React application (served by Vite) responsible for the user interface and interaction.
*   **Backend:** A Node.js (Express.js) application responsible for handling Gemini API requests and securely managing the Gemini API key.

```
+-----------------+       +-----------------+       +-----------------+
|     Frontend    |       |     Backend     |       |    Gemini API   |
| (React/Vite)    |-----> | (Node.js/Express)|-----> | (Google Gen AI) |
|                 |       |                 |       |                 |
| - User Interface|       | - API Key Mgmt  |       | - Code Review   |
| - Calls /api/gemini/review |       | - Calls Gemini API|       |   Generation    |
+-----------------+       +-----------------+       +-----------------+
        ^
        | (Proxy)
        |
+-----------------+
|   Vite Dev Server|
+-----------------+
```

### 4.2. Frontend Changes

*   **`services/geminiService.ts`:**
    *   Remove direct `GoogleGenAI` instantiation and API key usage.
    *   Modify `reviewCode` function to make an `HTTP POST` request to `/api/gemini/review` on the backend, sending the `diffForPrompt` in the request body.
    *   Handle responses from the backend API.
*   **`vite.config.ts`:**
    *   Configure a proxy rule to forward requests to `/api` to the backend server (e.g., `http://localhost:3000`).
*   **`index.html`:**
    *   Remove any client-side injection of the Gemini API key (e.g., `<script src="/config.js"></script>`).

### 4.3. Backend Changes

*   **New `backend/` directory:**
    *   Initialize a new Node.js project (`package.json`).
    *   Install necessary dependencies: `express`, `dotenv`, `@google/generative-ai`, `ts-node`, `typescript`.
    *   Create `backend/index.ts` as the main entry point.
    *   Create `backend/tsconfig.json` for TypeScript configuration.
*   **`backend/index.ts`:**
    *   Set up an Express.js server.
    *   Load `GEMINI_API_KEY` from environment variables using `dotenv`.
    *   Instantiate `GoogleGenAI` with the securely loaded API key.
    *   Define a `POST /api/gemini/review` endpoint.
    *   This endpoint will receive the `diffForPrompt` from the frontend.
    *   It will then call the Gemini API using the `GoogleGenAI` instance.
    *   The response from Gemini will be parsed and returned directly to the frontend.
    *   Implement error handling for API calls and missing API keys.

### 4.4. Deployment/Execution

*   **`entrypoint.sh`:**
    *   Modify to start both the backend server (e.g., `npm --prefix ./backend run start &`) and the frontend development server (`npm run dev`).

## 5. Out of Scope

*   Implementing a robust authentication/authorization mechanism for the backend (beyond API key security).
*   Advanced backend features like rate limiting, caching, or database integration.
*   Changes to the GitLab API interaction logic (this remains on the frontend for now).

## 6. Success Metrics

*   The application functions identically from a user perspective (code review generation, feedback display, GitLab integration).
*   The Gemini API key is no longer present in the client-side bundle or network requests initiated by the frontend.
*   Both frontend and backend services start successfully via the `entrypoint.sh` script.
*   No new critical security vulnerabilities are introduced.
