#!/usr/bin/env python3
"""
End-to-end validator to ensure project/baseline IDs stay unique across API + DynamoDB.

The script:
- Reads Cognito tokens/credentials from environment (no prompting).
- Creates three projects against the Finanzas API and builds a baseline for each.
- Hands off and accepts baselines to mirror the PMO estimator flow when required.
- Queries DynamoDB directly to verify PK/SK uniqueness and baseline linkage.

Environment inputs (all optional with sensible fallbacks):
- API base URL: FINZ_API_BASE, VITE_API_BASE_URL, DEV_API_URL, API_BASE_URL
- Bearer token: FINZ_JWT, FINZ_ID_TOKEN, ID_TOKEN, COGNITO_ID_TOKEN,
  COGNITO_ACCESS_TOKEN, ACCESS_TOKEN, AUTH_TOKEN
- Cognito username (for metadata/accepted_by): COGNITO_TEST_USER
- Dynamo tables: TABLE_PROJECTS (default finz_projects),
  TABLE_PREFACTURAS (default finz_prefacturas)
- AWS region: AWS_REGION (default us-east-2)
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import sys
import uuid
from collections import Counter
from typing import Dict, List, Tuple

import boto3
import requests
from boto3.dynamodb.conditions import Key
from botocore.config import Config


API_BASE_ENV_KEYS = (
    "FINZ_API_BASE",
    "VITE_API_BASE_URL",
    "DEV_API_URL",
    "API_BASE_URL",
)
TOKEN_ENV_KEYS = (
    "FINZ_JWT",
    "FINZ_ID_TOKEN",
    "ID_TOKEN",
    "COGNITO_ID_TOKEN",
    "COGNITO_ACCESS_TOKEN",
    "ACCESS_TOKEN",
    "AUTH_TOKEN",
)


class ValidationError(Exception):
    """Raised when validation detects data integrity issues."""


def _resolve_api_base() -> str:
    for key in API_BASE_ENV_KEYS:
        value = os.getenv(key, "").strip()
        if value:
            return value.rstrip("/")
    raise ValidationError(
        "API base URL is not configured. Set one of FINZ_API_BASE, VITE_API_BASE_URL, DEV_API_URL, or API_BASE_URL."
    )


def _resolve_bearer_token() -> Tuple[str, str]:
    for key in TOKEN_ENV_KEYS:
        value = os.getenv(key, "").strip()
        if value:
            return value, key
    raise ValidationError(
        "Bearer token not found in environment. Provide Cognito tokens via FINZ_JWT, FINZ_ID_TOKEN, COGNITO_ID_TOKEN, or related vars."
    )


def _auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _iso_date(days: int = 0) -> str:
    return (_dt.date.today() + _dt.timedelta(days=days)).isoformat()


def _session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def create_project(api_base: str, token: str, idx: int) -> Tuple[str, Dict]:
    payload = {
        "name": f"PK-SK Validation Project {idx}",
        "code": f"VAL-{uuid.uuid4().hex[:8]}",
        "client": "QA Validator",
        "start_date": _iso_date(),
        "end_date": _iso_date(30),
        "currency": "USD",
        "mod_total": 100000 + (idx * 1000),
        "description": "Automated PK/SK uniqueness validation",
    }

    resp = _session().post(f"{api_base}/projects", headers=_auth_headers(token), data=json.dumps(payload), timeout=30)
    resp.raise_for_status()
    data = resp.json() if resp.text else {}
    project_id = data.get("projectId") or data.get("project_id") or data.get("id")
    if not project_id:
        raise ValidationError(f"API did not return projectId for project payload {payload!r}")
    return project_id, data


def create_baseline(api_base: str, token: str, project_id: str, idx: int) -> Dict:
    now = _dt.datetime.utcnow().isoformat()
    payload = {
        "project_id": project_id,
        "project_name": f"PK-SK Validation Project {idx}",
        "project_description": "PK/SK guardrail regression",
        "client_name": "QA Validator",
        "currency": "USD",
        "start_date": _iso_date(),
        "duration_months": 12,
        "contract_value": 100000 + (idx * 1000),
        "labor_estimates": [],
        "non_labor_estimates": [],
        "assumptions": ["automated validation"],
        "signed_by": os.getenv("COGNITO_TEST_USER", "pmo-automation@example.com"),
        "signed_role": "PMO",
        "signed_at": now,
    }

    resp = _session().post(f"{api_base}/baseline", headers=_auth_headers(token), data=json.dumps(payload), timeout=30)
    resp.raise_for_status()
    return resp.json() if resp.text else {}


def handoff_baseline(api_base: str, token: str, project_id: str, baseline_id: str) -> Dict:
    payload = {
        "baseline_id": baseline_id,
        "mod_total": 100000,
        "pct_ingenieros": 70,
        "pct_sdm": 30,
        "project_name": f"Handoff {baseline_id}",
        "client_name": "QA Validator",
    }
    resp = _session().post(
        f"{api_base}/projects/{project_id}/handoff",
        headers=_auth_headers(token),
        data=json.dumps(payload),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json() if resp.text else {}


def accept_baseline(api_base: str, token: str, project_id: str, baseline_id: str) -> Dict:
    payload = {"baseline_id": baseline_id, "accepted_by": os.getenv("COGNITO_TEST_USER", "qa-validator@example.com")}
    resp = _session().patch(
        f"{api_base}/projects/{project_id}/accept-baseline",
        headers=_auth_headers(token),
        data=json.dumps(payload),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json() if resp.text else {}


def _dynamo_tables():
    region = os.getenv("AWS_REGION", "us-east-2")
    projects_table = os.getenv("TABLE_PROJECTS", "finz_projects")
    prefacturas_table = os.getenv("TABLE_PREFACTURAS", "finz_prefacturas")
    dynamo = boto3.resource("dynamodb", region_name=region, config=Config(retries={"max_attempts": 5, "mode": "standard"}))
    return dynamo.Table(projects_table), dynamo.Table(prefacturas_table)


def _fetch_project_metadata(table, project_id: str) -> Dict:
    pk = f"PROJECT#{project_id}"
    response = table.get_item(Key={"pk": pk, "sk": "METADATA"})
    return response.get("Item", {})


def _fetch_baseline_records(table, project_id: str, baseline_id: str) -> Tuple[Dict, Dict]:
    project_pk = f"PROJECT#{project_id}"
    baseline_sk = f"BASELINE#{baseline_id}"

    project_link = table.get_item(Key={"pk": project_pk, "sk": baseline_sk}).get("Item", {})
    metadata = table.get_item(Key={"pk": f"BASELINE#{baseline_id}", "sk": "METADATA"}).get("Item", {})

    if not project_link:
        # Query as fallback to surface the closest match for diagnostics
        query_resp = table.query(
            KeyConditionExpression=Key("pk").eq(project_pk),
            Limit=20,
        )
        alt = query_resp.get("Items", [])
        if alt:
            project_link = alt[0]
    return project_link, metadata


def _print_report(results: List[Dict]):
    print("\n=== PK/SK Uniqueness Report ===")
    for entry in results:
        print(
            f"Project {entry['project_id']}: pk={entry['project_pk']} sk={entry['project_sk']} | "
            f"Baseline {entry['baseline_id']}: pk={entry['baseline_pk']} sk={entry['baseline_sk']}"
        )
        if entry.get("collisions"):
            print(f"  Collisions: {entry['collisions']}")
        if entry.get("warnings"):
            print(f"  Warnings: {entry['warnings']}")

    all_pks = Counter(r["project_pk"] for r in results if r.get("project_pk"))
    all_pairs = Counter((r["project_pk"], r["project_sk"]) for r in results if r.get("project_pk"))

    dup_pks = [pk for pk, count in all_pks.items() if count > 1]
    dup_pairs = [pair for pair, count in all_pairs.items() if count > 1]

    if dup_pks:
        print(f"\n🚨 Duplicate project PKs detected: {dup_pks}")
    if dup_pairs:
        print(f"\n🚨 Duplicate project PK/SK pairs detected: {dup_pairs}")
    if not dup_pks and not dup_pairs:
        print("\n✅ No PK/SK collisions detected among created projects.")


def main() -> int:
    try:
        api_base = _resolve_api_base()
        token, token_source = _resolve_bearer_token()
    except ValidationError as exc:
        print(f"Configuration error: {exc}")
        return 1

    projects_table, prefacturas_table = _dynamo_tables()
    created: List[Dict] = []

    for idx in range(1, 4):
        project_id, project_payload = create_project(api_base, token, idx)
        baseline = create_baseline(api_base, token, project_id, idx)
        baseline_id = baseline.get("baselineId") or baseline.get("baseline_id")
        if not baseline_id:
            raise ValidationError(f"Baseline creation missing baselineId for project {project_id}")

        handoff_baseline(api_base, token, project_id, baseline_id)
        accept_baseline(api_base, token, project_id, baseline_id)

        created.append(
            {
                "project_id": project_id,
                "project_payload": project_payload,
                "baseline_id": baseline_id,
                "baseline_response": baseline,
                "token_source": token_source,
            }
        )

    results: List[Dict] = []
    for record in created:
        project_item = _fetch_project_metadata(projects_table, record["project_id"])
        baseline_link, baseline_meta = _fetch_baseline_records(
            prefacturas_table, record["project_id"], record["baseline_id"]
        )

        warnings = []
        if not project_item:
            warnings.append("Project metadata not found")
        if project_item and project_item.get("sk") != "METADATA":
            warnings.append(f"Unexpected project sk: {project_item.get('sk')}")
        if baseline_link and baseline_link.get("project_id") != record["project_id"]:
            warnings.append(
                f"Baseline link references project {baseline_link.get('project_id')} instead of {record['project_id']}"
            )
        if baseline_meta and baseline_meta.get("project_id") != record["project_id"]:
            warnings.append(
                f"Baseline metadata project_id {baseline_meta.get('project_id')} mismatches {record['project_id']}"
            )

        results.append(
            {
                "project_id": record["project_id"],
                "baseline_id": record["baseline_id"],
                "project_pk": project_item.get("pk"),
                "project_sk": project_item.get("sk"),
                "baseline_pk": baseline_meta.get("pk") or baseline_link.get("pk"),
                "baseline_sk": baseline_meta.get("sk") or baseline_link.get("sk"),
                "collisions": record.get("collisions", []),
                "warnings": warnings,
            }
        )

    _print_report(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
