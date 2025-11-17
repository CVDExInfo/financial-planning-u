# Evidence Pack – Finanzas SD

## API – curl checks

```bash
BASE=https://<api-id>.execute-api.us-east-2.amazonaws.com/dev
curl -i "$BASE/health"
curl -i "$BASE/catalog/rubros"
curl -i "$BASE/plan/forecast?projectId=P-5ae50ace&months=6"
curl -i "$BASE/prefacturas?projectId=P-5ae50ace"
```

> Paste headers (showing `access-control-allow-origin`) and first 200 chars of body.

## UI – screenshots

- [ ] Project switch without blank projectId logs
- [ ] Tier selection creates a line item
- [ ] No "falling back to mock data" logs (mocks=false)
- [ ] Ikusi logo visible; demo creds hidden

## Newman – summary

> Paste the run table with ✔️ for all suites and confirmation of "no fallback markers".
