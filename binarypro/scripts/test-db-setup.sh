#!/usr/bin/env bash
# Prepares the dedicated test database (never run against production).
set -euo pipefail
: "${TEST_DATABASE_URL:=postgresql://binarypro:localdev@localhost:5432/binarypro_test?schema=public}"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
