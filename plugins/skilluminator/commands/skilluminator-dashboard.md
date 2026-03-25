You are running the Skilluminator Dashboard generator — regenerates the HTML dashboard from existing pattern data.

## STEP 1 — FIND patterns.json

Check these locations in order:
1. `patterns.json` in the current working directory
2. `data/patterns.json`

If neither exists, tell the user: "No patterns.json found. Run `/skilluminator` first to analyze your M365 work patterns, then run `/skilluminator-dashboard` to generate the dashboard."

Then STOP.

## STEP 2 — FIND THE GENERATOR SCRIPT

Look for `scripts/generate-dashboard.js`:
1. Check `scripts/generate-dashboard.js` relative to the repo root
2. If not found, search: `find . -name "generate-dashboard.js" -type f 2>/dev/null | head -3`

If not found, tell the user: "Dashboard generator script not found. Make sure you're in the skilluminator directory."

Then STOP.

## STEP 3 — GENERATE

Run the generator:
```bash
node scripts/generate-dashboard.js --input <patterns.json path> --output output/dashboard.html
```

Create the `output/` directory first if it doesn't exist.

## STEP 4 — OPEN IN BROWSER

Open the generated dashboard:
- Windows: `start output/dashboard.html`
- Mac: `open output/dashboard.html`
- Linux: `xdg-open output/dashboard.html`

## STEP 5 — REPORT

Print a short summary:
- Confirm the dashboard was generated
- Show the output file path
- Report pattern count and top candidate from the data
- Tell the user: "Run `/skilluminator` to refresh your data with a new analysis, or `/skilluminator [time range]` to analyze a different period."
