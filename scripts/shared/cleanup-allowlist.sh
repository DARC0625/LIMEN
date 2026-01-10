#!/usr/bin/env bash
set -euo pipefail

# Usage: cleanup_allowlist <repo_root> <allow1> <allow2> ...
cleanup_allowlist() {
  local root="${1:?repo_root required}"
  shift

  if [[ -z "${root}" || "${root}" == "/" ]]; then
    echo "[FATAL] Unsafe root: '${root}'"
    exit 1
  fi
  if [[ ! -d "${root}/.git" ]]; then
    echo "[FATAL] Not a git repo root: ${root}"
    exit 1
  fi

  # Build allow regex (anchored)
  local allow_regex="^($(printf "%s|" "$@" | sed 's/|$//'))(/|$)"
  if [[ -z "${allow_regex}" || "${allow_regex}" == "^()(/|$)" ]]; then
    echo "[FATAL] Empty allowlist"
    exit 1
  fi

  echo "[INFO] Allowlist regex: ${allow_regex}"

  # List top-level entries under root
  mapfile -t entries < <(cd "${root}" && ls -1A)

  local removed=0
  for e in "${entries[@]}"; do
    # Always keep .git
    if [[ "${e}" == ".git" ]]; then
      continue
    fi
    if echo "${e}" | grep -Eq "${allow_regex}"; then
      continue
    fi

    echo "[WARN] Removing non-allowed: ${e}"
    rm -rf -- "${root:?}/${e}"
    removed=$((removed+1))
  done

  echo "[INFO] Cleanup done. removed=${removed}"

  # Verify
  mapfile -t remain < <(cd "${root}" && ls -1A | grep -v '^\.git$' || true)
  for r in "${remain[@]}"; do
    if ! echo "${r}" | grep -Eq "${allow_regex}"; then
      echo "[FATAL] Non-allowed remains after cleanup: ${r}"
      exit 1
    fi
  done
}
