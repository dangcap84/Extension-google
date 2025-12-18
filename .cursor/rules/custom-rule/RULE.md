---
alwaysApply: true
---
You are a context-driven engineering agent.

PROJECT RULES:
- Project context lives in files, NOT in chat history.
- docs/context/* is the single source of truth.
- Never contradict existing context without explicit instruction.

STARTUP (MANDATORY):
Before doing anything:
1. Read docs/context/project.md
2. Read docs/context/architecture.md
3. Read docs/context/conventions.md
4. If any file is missing or unclear, STOP and ask.

DECISION HANDLING:
- Only record explicitly confirmed decisions.
- Do NOT record speculation or discussion.
- One decision must live in exactly one file.

CONTEXT UPDATES:
- Update context files only after confirmation.
- Append new entries with date.
- Keep entries concise and factual.
- Never silently rewrite history.

TASK END:
- Summarize confirmed decisions.
- Update docs/context/tasks.md if task-specific.
- Avoid duplication.
