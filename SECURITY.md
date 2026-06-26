# Security

- Input validation on all API endpoints (Pydantic v2)
- UUID v4 format validation on session_id
- Candidate profile size limit: 50KB max
- Concurrent session limit: 10 max simultaneous runs
- CORS restricted to localhost:3000 in development
- No candidate data persisted — all state in-memory,
  cleared on server restart
- API keys loaded from .env — never committed to code
- .env files listed in .gitignore
