#!/bin/sh
set -eu
exec sh "$(dirname -- "$0")/scripts/bridge-linux.sh" start "$@"
