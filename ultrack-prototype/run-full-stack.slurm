#!/usr/bin/env bash
#SBATCH --job-name=ultrack-prototype
#SBATCH --output=ultrack-prototype-%j.out
#SBATCH --error=ultrack-prototype-%j.err
#SBATCH --ntasks=1

set -ueo pipefail

unset XDG_RUNTIME_DIR

REPO_ROOT=$(git rev-parse --show-toplevel)

if command -v uv &> /dev/null; then
    echo "uv already installed..."
else
    echo "installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi


if [-s "NVM_DIR/nvm.sh" ]; then
    echo "nvm already installed..."
else
    echo "installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install 20
npm i

function cleanup {
    echo "(cleanup) Stopping servers..."
    kill $FE_PID $BE_PID
    wait $FE_PID $BE_PID
    echo "Servers stopped."
}

trap cleanup SIGTERM SIGINT

npm run dev -- --mode prototype &
FE_PID=$!

uv --directory "$REPO_ROOT/ultrack-prototype/backend" run fastapi dev src/ultrack_learns/server.py &
BE_PID=$!

echo "FE_PID=$FE_PID"
echo "BE_PID=$BE_PID"

wait $FE_PID $BE_PID
