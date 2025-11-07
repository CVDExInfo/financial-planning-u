#!/usr/bin/env bash
# Helper to assume an AWS IAM Role for the current shell
# Usage examples:
#   ./scripts/assume-role.sh \
#     arn:aws:iam::703671891952:role/ProjectplaceLambdaRole us-east-2 3600 dev-session [source-profile]
# Notes:
# - If source-profile is omitted, the script will use current env AWS_ creds.
# - If no creds in env, the script will interactively prompt for temporary creds.
set -euo pipefail
ROLE_ARN="${1:-arn:aws:iam::703671891952:role/ProjectplaceLambdaRole}"
REGION="${2:-us-east-2}"
DURATION="${3:-3600}"
SESSION_NAME="${4:-vs-code-assume}"
SOURCE_PROFILE="${5:-}"

export AWS_REGION="$REGION"

# If no source profile and no env creds, prompt for temporary creds
need_prompt=false
if [[ -z "${SOURCE_PROFILE}" ]]; then
  if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
    need_prompt=true
  fi
fi

if [[ "$need_prompt" == true ]]; then
  echo "No source profile or env creds detected. Enter temporary credentials (values are not echoed)." 1>&2
  read -r -p "Access key ID: " AWS_ACCESS_KEY_ID
  read -r -s -p "Secret access key: " AWS_SECRET_ACCESS_KEY; echo
  read -r -p "Session token (optional, press Enter if none): " AWS_SESSION_TOKEN || true
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
  if [[ -n "${AWS_SESSION_TOKEN:-}" ]]; then export AWS_SESSION_TOKEN; fi
fi

ASSUME_ARGS=(--role-arn "$ROLE_ARN" --role-session-name "$SESSION_NAME" --duration-seconds "$DURATION")
if [[ -n "$SOURCE_PROFILE" ]]; then
  ASSUME_ARGS+=(--profile "$SOURCE_PROFILE")
fi

# Perform assume role
RESP=$(aws sts assume-role "${ASSUME_ARGS[@]}")
AKID=$(echo "$RESP" | jq -r '.Credentials.AccessKeyId')
SECK=$(echo "$RESP" | jq -r '.Credentials.SecretAccessKey')
TOKN=$(echo "$RESP" | jq -r '.Credentials.SessionToken')
EXP=$(echo "$RESP" | jq -r '.Credentials.Expiration')
ARN=$(echo "$RESP" | jq -r '.AssumedRoleUser.Arn')

export AWS_ACCESS_KEY_ID="$AKID"
export AWS_SECRET_ACCESS_KEY="$SECK"
export AWS_SESSION_TOKEN="$TOKN"

# Print summary and a quick verify
cat <<EOF
Assumed role successfully.
- Role ARN: $ROLE_ARN
- Session:  $SESSION_NAME
- Region:   $AWS_REGION
- Expires:  $EXP
- User ARN: $ARN

To verify in this shell:
  aws sts get-caller-identity
EOF
