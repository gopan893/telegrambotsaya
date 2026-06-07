# Improvement Dashboard

## Improvement Tab Features

The Improvement tab in the Dashboard provides full visibility and control over the Continuous Improvement Engine:

- Real-time feedback stream
- Outcome monitoring
- Weakness detection alerts
- Lesson management
- Regression case tracking
- Improvement plan overview
- Proposal approval workflow
- Audit log viewer
- Improvement report generation

## API Endpoints

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/improvement/overview` | Summary stats (totals, trends) |
| 2 | GET | `/api/improvement/feedback` | List feedback (paginated) |
| 3 | POST | `/api/improvement/feedback` | Submit feedback |
| 4 | GET | `/api/improvement/feedback/:id` | Get feedback detail |
| 5 | GET | `/api/improvement/outcomes` | List outcomes (paginated) |
| 6 | GET | `/api/improvement/outcomes/:id` | Get outcome detail |
| 7 | GET | `/api/improvement/weaknesses` | List weaknesses |
| 8 | GET | `/api/improvement/weaknesses/:id` | Get weakness detail |
| 9 | GET | `/api/improvement/lessons` | List lessons (paginated, filterable) |
| 10 | GET | `/api/improvement/lessons/:id` | Get lesson detail |
| 11 | POST | `/api/improvement/lessons` | Create lesson (admin) |
| 12 | PATCH | `/api/improvement/lessons/:id` | Update lesson status |
| 13 | GET | `/api/improvement/regression-cases` | List regression cases |
| 14 | GET | `/api/improvement/regression-cases/:id` | Get regression case detail |
| 15 | GET | `/api/improvement/plans` | List improvement plans |
| 16 | GET | `/api/improvement/proposals` | List proposals |
| 17 | PATCH | `/api/improvement/proposals/:id` | Approve/reject proposal |

## Frontend Sections

### Overview
Stats cards: total feedback, open weaknesses, active lessons, pending proposals. Trend charts for improvement velocity.

### Feedback
Table of all feedback with source, timestamp, classification, and actions column. Click to expand detail. Filter by source, classification, date range.

### Outcomes
Table of agent action outcomes. Shows agent, intent, result, tokens, user rating. Filter by agent, result, date range.

### Weaknesses
List of detected weaknesses with pattern, frequency, first/last seen. Color-coded by severity. Click to view linked feedback and derived lessons.

### Lessons
Lesson list with status, category, severity. Filter by status, category, severity. Click to view full lesson detail. Admin can create, archive, supersede lessons.

### Regression Cases
List of regression cases with risk level, source, status. Click to view full case and run manual test verification.

### Plans
Improvement plans showing grouped lessons, priority, estimated impact, acceptance criteria. Status: draft → active → completed.

### Proposals
Proposal queue showing proposed changes, evaluation status, approval status. Approve/reject buttons for authorized users. Links to diff view.

### Report
Generated improvement reports: PDF/CSV export. Summary of all improvement activities in a date range. Includes lessons learned, regression cases resolved, proposals approved.

## How to Use Each Section

### Monitoring Feedback
1. Open Improvement tab
2. Click "Feedback" section
3. Review incoming feedback in real-time
4. Click any entry to see full detail and classification

### Reviewing Outcomes
1. Go to "Outcomes" section
2. Filter by failed outcomes to find issues
3. Identify high-cost outliers
4. Click to drill into specific agent actions

### Managing Lessons
1. Go to "Lessons" section
2. Review active lessons sorted by severity
3. Click lesson to see root cause and recommendation
4. Archive resolved lessons or supersede with better ones
5. Manually create lessons for known issues

### Handling Proposals
1. Go to "Proposals" section
2. Review pending proposals
3. Click proposal to see full diff and evaluation results
4. Approve or reject with comment
5. Track execution status

### Generating Reports
1. Go to "Report" section
2. Select date range
3. Click "Generate Report"
4. Download PDF or CSV
5. Report includes all improvement activity in range

## Mobile-Friendly Design

- Responsive layout adapts to screen width
- Cards stack vertically on small screens
- Tables scroll horizontally
- Touch-friendly buttons and filters
- Collapsible sections for dense data
- Pull-to-refresh for real-time updates

## Dark Mode

- Full dark mode support via CSS variables
- Automatic detection of system preference
- Manual toggle in Dashboard settings
- All charts and graphs respect dark palette
- High contrast mode available
