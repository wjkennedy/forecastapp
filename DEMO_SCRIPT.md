# Jira Forecast Demo Script

## Product Announcement Demo - 5-7 Minutes

---

## OPENING (30 seconds)
**Title Slide: "Predict Your Delivery Dates with Confidence"**

### Talking Points:
- "Every sprint planning meeting, you get asked: 'When will this be done?'"
- "Most teams guess. Some teams hope. Smart teams forecast."
- "Today, we're introducing **Jira Forecast** - a breakthrough way to predict delivery dates using the data you already have."

---

## THE PROBLEM (1 minute)

**Show a calendar with question marks**

### Talking Points:
- "The challenge: You have historical data (completed work, team velocity), but you're not using it to predict the future."
- "Spreadsheets are painful. Estimation poker is subjective. You need data-driven predictions."
- "And you need them instantly, without leaving Jira."

### Visual:
- Screenshot of typical Jira project with 50+ issues in backlog

---

## THE SOLUTION: LIVE DEMO (3-4 minutes)

### SCENE 1: Run the Forecast (1 minute)
**Screen: Jira Forecast App**

1. **Select a project** - Click "Browse" and select a project (e.g., "PLATFORM")
   - Caption: "Pick any Jira project"

2. **Click "Run Forecast"**
   - Show it fetching data
   - Talking Point: "The app connects to Jira and analyzes your last 12 weeks of completed work."

3. **Watch the progress bar animate** (show during 10,000 sample simulation)
   - Caption: "10,000 Monte Carlo simulations running..."
   - Talking Point: "We're running 10,000 different scenarios based on your actual team throughput patterns."
   - Talking Point: "Notice the real-time progress meter - you can see exactly what's happening, not just a spinning loader."

### SCENE 2: The Results - Three Confidence Levels (1.5 minutes)
**Screen: Forecast Results**

Show the three P-values highlighted:

1. **P50 (50% probability)** - Green, optimistic
   - Talking Point: "This is your best-case scenario. If everything goes smoothly, you'll hit this date."
   - Caption: "You'd hit this date 50% of the time"

2. **P80 (80% probability)** - Orange, realistic
   - Talking Point: "This is the one you commit to stakeholders. Your team will deliver by this date 80% of the time."
   - Talking Point: "This is backed by Monte Carlo simulation, not wishful thinking."
   - Caption: "80% confidence - your target date"

3. **P95 (95% probability)** - Red, conservative
   - Talking Point: "Need an ironclad guarantee? This is the date when you're 95% confident."
   - Caption: "For contracts or critical commitments"

### Key Insight to Call Out:
"See how different these dates are? P50 vs P95 is [X weeks]. That's the difference between optimism and realism. Our app puts this front and center, so you can make better decisions."

### SCENE 3: Remaining Work Schedule (1 minute)
**Screen: Remaining Work with week-by-week breakdown**

1. **Scroll through the "Remaining Work" section**
   - Show Week 1, Week 2, Week 3, etc.
   - Pointing: "Each week shows the issues projected to complete that week."

2. **Color-coding**
   - Green issues: High confidence (within P50)
   - Orange issues: Medium confidence (P50-P80)
   - Red issues: At-risk (beyond P80)
   - Talking Point: "Red doesn't mean panic - it means 'plan for this.' It helps your team prioritize."

3. **Issue details**
   - Show story points, assignee, current status
   - Talking Point: "Every issue is a link back to Jira. Click to see details, update status, reassign."

4. **Summary cards at top**
   - Talking Point: "At a glance: [X] issues, [Y] story points, [Z] unestimated. These numbers feed into the forecast."

---

## THE SECRET SAUCE: Estimation Insights (30 seconds - Optional, Advanced)

**Screen: Estimation Insights Panel**

### Talking Points:
- "But here's where it gets really smart..."
- "We don't just tell you *when* you'll ship. We analyze *how accurate your team's estimates are*."
- "This graph shows estimation bias - are your team's 5-point stories actually harder than 2-point stories?"
- "If not, we give you recommendations: 'Calibrate estimates like this' or 'Break down larger stories.'"
- **Insight**: "Better estimates → Better forecasts → Better decisions."

---

## CLOSING & CALL TO ACTION (30 seconds)

**Return to main dashboard**

### Talking Points:
- "Jira Forecast does one thing and does it incredibly well:"
- "It turns your historical data into a crystal ball for delivery dates."
- "No guessing. No spreadsheets. No crying in sprint planning."
- "Just confidence, backed by math."

### Final Message:
- "Try it now on any Jira project."
- "Run a forecast, see the three dates, plan accordingly."
- "Your stakeholders will ask 'How did you predict that so accurately?' 
- "You'll say: 'Data.'"

---

## DEMO FLOW SUMMARY

```
Open App
  ↓
Select Project (PLATFORM) 
  ↓
Run Forecast
  ↓
[Show progress meter animating - 30 sec]
  ↓
Forecast Results appear
  ↓
Highlight P50/P80/P95 with talking points
  ↓
Scroll to Remaining Work
  ↓
Show week-by-week breakdown, color-coding
  ↓
(Optional) Show Estimation Insights
  ↓
Call to action
```

---

## KEY STATS TO MENTION

- "Analyzed [X] completed issues over 12 weeks"
- "Current team velocity: [Y] points/week"
- "Remaining: [Z] story points across [N] issues"
- "Confidence in forecast: Backed by 10,000 Monte Carlo simulations"

---

## TALKING POINTS FOR Q&A

**"How accurate is this?"**
- "As accurate as your historical data and current team velocity. We don't guess - we simulate."
- "If your velocity is stable, expect +/- 1-2 weeks accuracy."

**"What if our velocity changes?"**
- "Re-run the forecast. It takes 30 seconds. Use it for sprint planning, mid-sprint re-planning, whatever you need."

**"Can we adjust for holidays or reduced capacity?"**
- "Not in this version, but you can manually filter the data or re-run with adjusted baselines."

**"What about changing scope?"**
- "Scope changes? Re-run the forecast with the new remaining work."

---

## VISUAL CHECKLIST

- [ ] Sample project selected
- [ ] Forecast results visible
- [ ] P50/P80/P95 clearly highlighted
- [ ] Remaining work section showing week breakdown
- [ ] Color-coded confidence levels visible
- [ ] Progress meter animation (during simulation)
- [ ] (Optional) Estimation insights section
