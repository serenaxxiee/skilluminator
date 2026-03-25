# Skilluminator

Analyzes your M365 work activity to discover which of your repeated work patterns are the best candidates for AI automation — and generates a visual dashboard of the findings.

Works with any role. Powered by WorkIQ + Claude Code.

[View the infographic](https://serenaxxiee.github.io/skilluminator/)

## Install

### 1. Add the marketplace

```
/plugin marketplace add serenaxxiee/skilluminator
```

### 2. Install the plugin

```
/plugin install skilluminator
```

That's it — WorkIQ is configured automatically via the bundled MCP server config.

### Prerequisites

- [Claude Code](https://claude.ai/claude-code) installed
- Microsoft 365 account with WorkIQ access

## Usage

### Run the analysis

```
/skilluminator:skilluminator past 30 days
```

Or with other time ranges:

```
/skilluminator:skilluminator past 7 days
/skilluminator:skilluminator past 2 weeks
/skilluminator:skilluminator in March 2026
```

### Regenerate the dashboard

```
/skilluminator:skilluminator-dashboard
```

### Build a skill from a candidate

```
/skill-creator [candidate-name]
```

## What it does

1. Queries your email, meetings, Teams chats, and documents via WorkIQ
2. Extracts repeating behavioral signals and clusters them into patterns
3. Filters out patterns already handled by M365 built-in tools (Teams Copilot, Focused Inbox, etc.)
4. Verifies actual meeting attendance (not just calendar invites)
5. Scores patterns on automation feasibility and business value
6. Generates an interactive HTML dashboard with analytics and top skill candidates
7. Offers to build any candidate via `/skill-creator`

## How scoring works

Each pattern is scored on two dimensions:

**Automation Score (0-100):** How rule-based and repetitive is it?
- Clear trigger, fixed output, same steps, no sensitive sign-off, single source, high volume

**Value Score (0-100):** How much does it cost you?
- Time cost, frequency, blocks others, critical workflow, pain expressed

**Composite = (Automation x 0.55) + (Value x 0.45)**

| Tier | Score | Meaning |
|------|-------|---------|
| Strong | 70+ | High automation potential AND high value. Build first. |
| Moderate | 50-69 | Automatable but may need human-in-the-loop. Worth building. |
| Exploring | <50 | Painful but hard to automate. Consider partial solutions. |

## What gets filtered out

- Patterns already handled by M365 built-in tools (Teams Copilot Meeting Recap, Chat Recap, etc.)
- Patterns based on unverified meeting attendance (calendar invites != attendance)
- Patterns below the relevance threshold (<30 min/week AND <5/week AND single-source AND no pain signals)

## Plugin structure

```
plugins/
  skilluminator/
    .claude-plugin/
      plugin.json
    .mcp.json                              # WorkIQ MCP server (auto-configured)
    commands/
      skilluminator.md                     # /skilluminator:skilluminator command
      skilluminator-dashboard.md           # /skilluminator:skilluminator-dashboard command
    skills/
      skilluminator/
        SKILL.md                           # Core skill definition
    scripts/
      generate-dashboard.js                # Dashboard generator
```

## License

MIT
