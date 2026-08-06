#!/usr/bin/env bash
#
# Vitest'i çalıştırır ve `dogrula.sh`'ın okuyabileceği özet satırını basar.
# Doğrudan çalıştırmak isterseniz `npm test` yeterlidir.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

CIKTI="$(npx vitest run 2>&1)"
echo "$CIKTI"

# Vitest özeti şu biçimlerden birindedir:
#   Tests  35 passed (35)
#   Tests  2 failed | 33 passed (35)
OZET="$(grep -E '^\s*Tests\s' <<< "$CIKTI" | tail -1)"
GECTI="$(grep -oE '[0-9]+ passed' <<< "$OZET" | grep -oE '[0-9]+' | head -1)"
KALDI="$(grep -oE '[0-9]+ failed' <<< "$OZET" | grep -oE '[0-9]+' | head -1)"

echo "SONUC gecti=${GECTI:-0} kaldi=${KALDI:-0}"
[[ "${KALDI:-0}" -gt 0 ]] && exit 1
[[ "${GECTI:-0}" -eq 0 ]] && exit 1   # hiç test çalışmadıysa da başarısız say
exit 0
