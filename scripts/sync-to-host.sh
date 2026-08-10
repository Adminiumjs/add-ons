#!/usr/bin/env bash
# sync-to-host.sh — vendor this repo's add-on client halves into a host app's
# checkout, from this end of the pipe.
#
# THIS IS A WRAPPER. The implementation is `scripts/sync-add-ons.sh` in the host
# app, and it stays there for the reason it was moved there in the first place:
# the host is what has to build from a clean clone, its CI is what has to be
# able to run the check, and a cloner of the host must be able to run it without
# also cloning this repository.
#
# IT USED TO BE A SECOND FULL IMPLEMENTATION — the same file list, the same
# header text, the same import rewrite, written out twice. That is precisely the
# disease this repository exists to cure. Three add-ons each keeping their own
# copy of one contract is how `AddOn` came to have 19 members in one package, 18
# in another and 18 in a third; two scripts each keeping their own copy of one
# file list is the same defect wearing a different hat, and it would have shown
# up as a `status` that reports DRIFT on a tree the other script just wrote.
#
# So there is one list, one header and one rewrite, and they live with the host.
# What is left here is the entry point, because `npm run sync-to-host` from this
# repo is a reasonable thing to want.
#
#   <somewhere>/add-ons      ← this repo
#   <somewhere>/print-shop   ← the host
#
# Override with HOST_DIR=/path/to/print-shop. With no host checkout present,
# `status` says so and exits 0 — a clean clone of this repo alone still builds
# and tests green. `sync` in that situation is an error, because there is
# nowhere to sync TO.
#
# NOTE that `list` now needs the host too. The list of files a host vendors is
# the HOST's decision — it is the one that knows its bundle must not be able to
# reach a server half — so it is not a question this repository can answer on
# its own.
#
# Usage (passed straight through):
#   scripts/sync-to-host.sh status | sync | list

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST_DIR:-$(cd "$ROOT/.." && pwd)/print-shop}"
SHIPPED="$HOST/scripts/sync-add-ons.sh"

[ -d "$ROOT/packages/host/src" ] || {
  printf '\033[31mrun this from inside the add-ons monorepo\033[0m\n' >&2
  exit 1
}

if [ ! -f "$SHIPPED" ]; then
  if [ "${1:-status}" = status ]; then
    printf '\033[33mHOST-MISSING: no host checkout at %s\033[0m\n' "$HOST"
    printf '\033[33mnothing to compare. Clone it beside this repo, or set HOST_DIR.\033[0m\n'
    exit 0
  fi
  printf '\033[31mno host checkout at %s\033[0m\n' "$HOST" >&2
  printf 'the sync script ships in the host repo — clone print-shop beside this one,\n' >&2
  printf 'or set HOST_DIR to where it lives\n' >&2
  exit 1
fi

# ADD_ONS_DIR is how the host names THIS repo. Setting it means a host checked
# out somewhere unusual, or this repo checked out somewhere unusual, still
# reaches the right sources.
ADD_ONS_DIR="$ROOT" exec bash "$SHIPPED" "$@"
