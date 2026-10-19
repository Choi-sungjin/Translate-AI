#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$(uname -s)" != Linux ]; then echo 'This launcher requires Linux.' >&2; exit 1; fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 22 or newer is required. Install Node.js, then run this script again.' >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || {
  echo 'Node.js 22 or newer is required.' >&2; exit 1;
}
command -v flock >/dev/null 2>&1 || { echo 'Install util-linux (flock) first.' >&2; exit 1; }
state_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Translate-AI"
umask 077
mkdir -p "$state_dir"
cd "$project_dir"
# Close the lock descriptor in children so the background bridge cannot retain it.
exec flock --nonblock --conflict-exit-code 73 --close "$state_dir/launcher.lock" node scripts/linux-launcher.mjs "$@"
