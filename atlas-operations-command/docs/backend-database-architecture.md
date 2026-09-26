# Backend & Database Architecture

## High-Level Architecture Diagram

```text
                         ┌──────────────────────┐
                         │       USERS          │
                         │ Admin / Operator /   │
                         │ Viewer / Management  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   React Frontend     │
                         │ React + TypeScript   │
                         └──────────┬───────────┘
                                    │
                         HTTPS / REST / WebSocket
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │        FASTAPI BACKEND       │
                    │                              │
                    │ Authentication               │
                    │ Authorization / RBAC         │
                    │ Dashboard                    │
                    │ Business Data                │
                    │ Factory Operations           │
                    │ Financial                    │
                    │ Inventory                    │
                    │ Vendor                       │
                    │ SLA                          │
                    │ Risk                         │
                    │ AI                           │
                    │ SAP                          │
                    │ File Processing              │
                    │ Reports                      │
                    │ Notifications                │
                    │ Audit                        │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                     │
              ▼                    ▼                     ▼
      ┌───────────────┐     ┌─────────────┐      ┌──────────────┐
      │      MySQL    │     │    Redis    │      │ S3 / Storage │
      │ Main Database │     │ Cache/Queue │      │ Files        │
      └───────────────┘     └──────┬──────┘      └──────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Celery Workers  │
                          │ Background Jobs │
                          └───────┬─────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
              SAP/ERP          Gemini AI       File Parser
```

## System Components

### 1. Frontend Layer
- **React Frontend:** Built with React and TypeScript, providing interfaces for Admins, Operators, Viewers, and Management.
- **Communication:** Communicates with the backend via HTTPS REST APIs and WebSockets (for real-time notifications and updates).

### 2. Backend Layer (FastAPI)
The core backend is built using **FastAPI** (Python), handling all business logic, API routing, and interactions with data layers and external services. Key modules include:
- **Security & Access:** Authentication, Authorization / Role-Based Access Control (RBAC).
- **Core Operations:** Dashboard, Business Data, Factory Operations.
- **Business Modules:** Financial, Inventory, Vendor, SLA, Risk.
- **Integrations & Services:** AI, SAP, File Processing, Reports, Notifications, Audit.

### 3. Data Storage Layer
- **PostgreSQL (Main Database):** Relational database storing all structured application data, user profiles, transactional records, and operational data.
- **Redis (Cache/Queue):** In-memory data structure store used for caching frequent queries and acting as a message broker for background task queues.
- **S3 / Storage (Files):** Object storage used for keeping unstructured files, uploaded documents, generated reports, and parsed assets.

### 4. Asynchronous Processing Layer
- **Celery Workers:** Background job processing system that consumes tasks from Redis queues to handle heavy, time-consuming operations without blocking the main API threads.
- **Background Tasks Include:** 
  - **SAP/ERP:** Synchronization of data and external operational commands with enterprise systems.
  - **Gemini AI:** Handling AI queries, automated data extraction, generative reporting, or insights generation.
  - **File Parser:** Heavy document parsing operations running asynchronously.

////

ATLASOPS CMD
│
├── PHASE 1 — Backend Foundation
│   ├── Unit 1
│   ├── Unit 2
│   ├── Unit 3
│   └── ...
│
├── PHASE 2 — Database
│   ├── Unit 1
│   ├── Unit 2
│   └── ...
│
├── PHASE 3 — Authentication & RBAC
│
├── PHASE 4 — Company & Factory
│
├── PHASE 5 — Dashboard APIs
│
├── PHASE 6 — Financial
│
├── PHASE 7 — Operations
│
├── PHASE 8 — SAP / Files
│
├── PHASE 9 — AI / Gemini
│
├── PHASE 10 — Background Jobs
│
├── PHASE 11 — Real-time
│
├── PHASE 12 — Reports
│
├── PHASE 13 — Security
│
├── PHASE 14 — Testing
│
├── PHASE 15 — Performance
│
├── PHASE 16 — Staging
│
└── PHASE 17 — Production