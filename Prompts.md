Build a modern AI-powered web application called "Config Drift Detector".

Purpose:
The application compares an intended configuration file with an actual/live configuration file, detects configuration drift, explains the impact using AI, assigns severity levels, and generates a downloadable report.

Tech Stack:

* Frontend: Modern responsive web UI
* Backend: Python
* Config Comparison: DeepDiff
* AI Integration: Gemini API
* File Formats: JSON and YAML
* Report Format: Markdown and PDF

UI Requirements:

Design Style:

* Modern SaaS dashboard
* Clean and professional
* Dark mode support
* Responsive design
* Smooth animations
* Card-based layout
* Blue/Purple gradient accents
* Attractive charts and statistics

Navigation:

1. Dashboard
2. Drift Analysis
3. Reports
4. Settings

Dashboard Features:

* Total Files Analyzed
* Total Drifts Detected
* Breaking Issues Count
* Functional Issues Count
* Cosmetic Issues Count
* Severity Distribution Chart
* Recent Analysis History

Main Analysis Page:

Header:
"AI Config Drift Detector"

Upload Section:

* Drag and Drop Area
* Upload Intended Configuration File
* Upload Actual Configuration File
* Support JSON and YAML
* Show uploaded file names

Analyze Button:
"Analyze Drift"

Loading State:

* Animated progress indicator
* Status messages:

  * Reading files
  * Comparing configurations
  * Running AI analysis
  * Generating report

Drift Detection Logic:
Compare intended and actual configuration files using DeepDiff.

For every detected difference:
Display:

* Configuration Key
* Old Value
* New Value
* Severity
* AI Explanation
* Recommended Fix

Severity Categories:

Breaking:

* SSL
* Port
* Database
* Authentication
* Security settings

Functional:

* Timeout
* Memory
* Retry
* Cache
* Performance settings

Cosmetic:

* Labels
* Descriptions
* Display names
* Non-functional settings

AI Analysis:
Send detected drifts to Gemini API.

Prompt Template:
Explain:

1. What changed
2. Impact
3. Risk level
4. Recommendation

Display AI Response inside a styled card.

Results Page:

Show:

* Summary Statistics
* Drift Table
* Severity Badges
* AI Recommendations
* Overall Risk Score

Color Coding:

* Breaking = Red
* Functional = Orange
* Cosmetic = Green

Charts:

* Severity Pie Chart
* Drift Count Bar Chart

Report Generation:
Generate downloadable:

* Markdown Report
* PDF Report

Report Content:

* File Names
* Drift Details
* Severity
* AI Explanation
* Recommendations
* Summary Statistics

Sample Output Format:

Drift:
debug

Old Value:
false

New Value:
true

Severity:
Functional

AI Explanation:
Debug mode has been enabled.
Sensitive information may be exposed.

Recommendation:
Disable debug mode in production.

Additional Features:

* Search drifts
* Filter by severity
* Sort by file name
* Export results
* Analysis history

Code Requirements:

* Clean architecture
* Modular components
* Error handling
* Loading states
* Input validation
* Environment variable support for Gemini API key

Generate a complete working application with a polished modern UI suitable for demonstrating in a placement drive project.
