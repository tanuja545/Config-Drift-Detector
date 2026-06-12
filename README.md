# AI-Powered Configuration Drift Detector

## Overview

The AI-Powered Configuration Drift Detector identifies configuration differences between intended and actual system configurations. It analyzes files, detects drifts, calculates risk scores, and generates reports.

---

## Features

- Configuration Drift Detection
- Risk Assessment
- Dashboard Analytics
- PDF Report Export
- Markdown Report Export
- History Tracking
- Gemini AI Integration

---

## Technology Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Python
- FastAPI

### AI
- Google Gemini API

---

## Project Structure

```text
actual/
intended/
backend/
frontend/
```

## Setup Instructions

### Clone Repository

```bash
git clone https://github.com/saicharan-122/Config-Drift-Detector.git
```

### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Run Application

```bash
uvicorn app:app --reload
```

Application will run at:

```text
http://localhost:8000
```

---

## Architecture Overview

```text
Frontend
    |
    v
FastAPI Backend
    |
    v
Drift Detection Engine
    |
    v
Gemini AI Analysis
```

---

## Assumptions

- Configuration files are valid JSON/YAML.
- Users provide intended and actual configurations.
- Internet connection is available for Gemini AI features.

---

## Limitations

- Supports limited configuration formats.
- Free deployment may sleep after inactivity.
- Gemini AI analysis depends on API availability.

---

## Live Demo

Render Deployment URL

---
