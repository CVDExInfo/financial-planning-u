#!/usr/bin/env bash
set -euo pipefail
aws sts get-caller-identity
aws configure get region || true
