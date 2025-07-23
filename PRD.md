# Product Requirements Document: Gemini Code Review Assistant

## 1. Introduction

This document outlines the requirements and architecture of the Gemini Code Review Assistant, a full-stack application designed to automate code reviews using Google's Gemini AI. The application integrates with GitLab to provide intelligent code review feedback on merge requests.

## 2. Goals

*   **Automated Code Review:** Leverage Gemini AI to provide comprehensive code review feedback, analyzing code quality, performance, security, and best practices.
*   **GitLab Integration:** Seamless integration with GitLab's merge request workflow, allowing users to fetch diffs and post comments directly.
*   **Flexible LLM Integration:** Support multiple LLM providers through a modular architecture, with initial support for Gemini API and CLI-based interactions.
*   **Security & Maintainability:** Keep sensitive credentials secure through backend management and maintain clean separation of concerns.

## 3. Features & Capabilities

### 3.1. Core Features

*   **GitLab Integration:**
    * Input GitLab Merge Request URLs to initiate reviews
    * Configure GitLab access tokens and instance URLs
    * Fetch merge request diffs and existing discussions
    * Post review comments back to GitLab

*   **Code Review Analysis:**
    * Code quality assessment
    * Performance analysis
    * Security vulnerability detection
    * Style and best practices evaluation
    * Bug detection

*   **Review Management:**
    * View generated feedback in a structured interface
    * Filter and sort review items by severity
    * Edit or ignore review items before posting
    * Track feedback status (submitted/pending)

### 3.2. Technical Features

*   **LLM Provider System:**
    * Modular LLM provider interface
    * Support for Gemini API via Google AI SDK
    * Support for Gemini CLI integration
    * Extensible for future LLM providers

*   **Configuration Management:**
    * Environment-based configuration
    * Secure API key handling
    * GitLab instance configuration
    * LLM provider selection

## 4. Technical Architecture

### 4.1. System Overview

```
+---------------+        +---------------+        +---------------+
|   Frontend    |        |    Backend    |        |  LLM Service  |
| (React/Vite)  | -----> | (Node/Express)| -----> | (Gemini API/  |
|               |        |               |        |  CLI)         |
+---------------+        +---------------+        +---------------+
       |                       |                        |
       |                       |                        |
       v                       v                        |
+---------------+        +---------------+              |
|   GitLab API  | <----- |  LLM Provider |              |
| (REST Client) |        |   Interface   | <------------+
+---------------+        +---------------+
```

### 4.2. Frontend Architecture

*   **Core Services:**
    * `aiReviewService.ts`: Handles AI code review functionality and backend API requests
    * `gitlabService.ts`: Handles GitLab API interactions
    * `configService.ts`: Manages application configuration

*   **Components:**
    * `CodeEditor.tsx`: Code diff visualization
    * `FeedbackPanel.tsx`: Review feedback display
    * `FileDiffCard.tsx`: Per-file diff display
    * `ConfigModal.tsx`: Configuration management
    * `MrSummary.tsx`: Merge request overview

### 4.3. Backend Architecture

*   **Services Layer:**
    * **LLM Provider Interface:**
        * Abstract provider interface for LLM integrations
        * Concrete implementations:
            * `GeminiProvider`: Uses Google AI SDK
            * `GeminiCliProvider`: Uses Gemini CLI tool
        * Factory pattern for provider instantiation

    * **LLM Service:**
        * Prompt engineering and formatting
        * Response parsing and validation
        * Error handling and logging

*   **Controller Layer:**
    * `GeminiController`:
        * Request validation
        * Provider coordination
        * Response formatting

*   **Infrastructure:**
    * Express.js server
    * Environment configuration
    * Error middleware
    * Logging system

### 4.4. Data Flow

1. **Review Request:**
   ```
   Frontend -> Backend:
   POST /api/review
   {
     diffForPrompt: string,
     discussions?: GitLabDiscussion[]
   }
   ```

2. **Review Response:**
   ```
   Backend -> Frontend:
   {
     filePath: string,
     lineNumber: number,
     severity: "Critical" | "Warning" | "Suggestion" | "Info",
     title: string,
     description: string
   }[]
   ```

### 4.5. Configuration

*   **Backend Environment:**
    * `LLM_PROVIDER`: Provider selection ('gemini-api'|'gemini-cli')
    * `LLM_API_KEY`: Gemini API key
    * `GOOGLE_CLOUD_PROJECT`: Required for CLI provider

*   **Frontend Configuration:**
    * GitLab instance URL
    * GitLab access token
    * UI preferences

## 5. Out of Scope

*   Implementing a robust authentication/authorization mechanism for the backend (beyond API key security).
*   Advanced backend features like rate limiting, caching, or database integration.
*   Changes to the GitLab API interaction logic (this remains on the frontend for now).

## 6. Success Metrics

*   The application functions identically from a user perspective (code review generation, feedback display, GitLab integration).
*   The Gemini API key is no longer present in the client-side bundle or network requests initiated by the frontend.
*   Both frontend and backend services start successfully via the `entrypoint.sh` script.
*   No new critical security vulnerabilities are introduced.
