#!/usr/bin/env python3
import json
import os
import sys
import time
from typing import Dict, List

import boto3
import requests

API_BASE = os.environ.get("FINZ_API_BASE") or os.environ.get("API_BASE_URL")
TOKEN = os.environ.get("FINZ_API_TOKEN") or os.environ.get("ACCESS_TOKEN")
REGION = os.environ.get("AWS_REGION", "us-east-2")

PROJECTS_TABLE = os.environ.get("TABLE_PROJECTS", "finz_projects")
PREFACTURAS_TABLE = os.environ.get("TABLE_PREFACTURAS", "finz_prefacturas")

if not API_BASE or not TOKEN:
    print("FINZ_API_BASE/API_BASE_URL and FINZ_API_TOKEN/ACCESS_TOKEN env vars are required", file=sys.stderr)
    sys.exit(2)

session = requests.Session()
session.headers.update({"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})

ddb = boto3.resource("dynamodb", region_name=REGION)
projects_table = ddb.Table(PROJECTS_TABLE)
prefacturas_table = ddb.Table(PREFACTURAS_TABLE)


def create_project(idx: int) -> Dict[str, str]:
    payload = {
        "name": f"Collision Guard {idx}",
        "code": f"PROJ-2030-{200+idx}",
        "client": "Validation",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31",
        "currency": "USD",
        "mod_total": 10000 + idx,
        "description": "PK/SK validation run",
    }
    resp = session.post(f"{API_BASE}/projects", data=json.dumps(payload))
    resp.raise_for_status()
    body = resp.json()
    project_id = body.get("projectId") or body.get("project_id") or body.get("id")
    if not project_id:
        raise RuntimeError(f"projectId missing in response: {body}")
    return {"projectId": project_id, "payload": body}


def create_baseline(project_id: str) -> Dict[str, str]:
    payload = {
        "project_id": project_id,
        "project_name": f"Baseline for {project_id}",
        "client_name": "Validation",
        "currency": "USD",
        "duration_months": 12,
        "labor_estimates": [
            {
                "role": "Dev",
                "hours_per_month": 20,
                "fte_count": 1,
                "hourly_rate": 50,
                "start_month": 1,
                "end_month": 1,
            }
        ],
        "non_labor_estimates": [],
    }
    resp = session.post(f"{API_BASE}/baseline", data=json.dumps(payload))
    resp.raise_for_status()
    body = resp.json()
    baseline_id = body.get("baselineId") or body.get("baseline_id")
    if not baseline_id:
        raise RuntimeError(f"baselineId missing in response: {body}")
    return {"baselineId": baseline_id, "payload": body}


def accept_baseline(project_id: str, baseline_id: str):
    resp = session.patch(
        f"{API_BASE}/projects/{project_id}/accept-baseline",
        data=json.dumps({"baseline_id": baseline_id}),
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Failed to accept baseline {baseline_id} for project {project_id}: {resp.text}")
    return resp.json()


def fetch_project_item(project_id: str) -> Dict:
    result = projects_table.get_item(Key={"pk": f"PROJECT#{project_id}", "sk": "METADATA"})
    return result.get("Item", {})


def fetch_baseline_item(baseline_id: str) -> Dict:
    result = prefacturas_table.get_item(Key={"pk": f"BASELINE#{baseline_id}", "sk": "METADATA"})
    return result.get("Item", {})


def main():
    created: List[Dict[str, str]] = []
    for i in range(3):
        project = create_project(i)
        baseline = create_baseline(project["projectId"])
        accept_baseline(project["projectId"], baseline["baselineId"])
        created.append({"projectId": project["projectId"], "baselineId": baseline["baselineId"]})
        time.sleep(0.5)

    diagnostics = []
    seen_keys = set()
    collisions = []

    for row in created:
        project_item = fetch_project_item(row["projectId"])
        baseline_item = fetch_baseline_item(row["baselineId"])
        proj_key = (project_item.get("pk"), project_item.get("sk"))
        if proj_key in seen_keys:
            collisions.append({"projectId": row["projectId"], "pk": project_item.get("pk"), "sk": project_item.get("sk")})
        else:
            seen_keys.add(proj_key)

        diagnostics.append({
            "projectId": row["projectId"],
            "projectPk": project_item.get("pk"),
            "projectSk": project_item.get("sk"),
            "baselineId": row["baselineId"],
            "baselinePk": baseline_item.get("pk"),
            "baselineSk": baseline_item.get("sk"),
            "baselineProjectId": baseline_item.get("project_id"),
        })

    print(json.dumps({"diagnostics": diagnostics}, indent=2))

    if collisions:
        print(f"FAIL: PK collision detected: {collisions}", file=sys.stderr)
        sys.exit(1)

    print("PASS: 3 projects created with unique PK/SK; baseline mapping correct")


if __name__ == "__main__":
    main()
