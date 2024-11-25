#!/usr/bin/env bash
#SBATCH --job-name=ultrack-prototype
#SBATCH --output=ultrack-prototype-%j.out
#SBATCH --error=ultrack-prototype-%j.err
#SBATCH --ntasks=1

set -ueo pipefail

# XDG_RUNTIME_DIR is used by some tools like uv and just
# this could be different on the job runner, which causes issues
unset XDG_RUNTIME_DIR

# REPO_ROOT is more reliable than BASH_SOURCE or SLURM_SUBMIT_DIR
# it works if `sbatch` is called from anywhere within the repository
REPO_ROOT=$(git rev-parse --show-toplevel)

if command -v uv &> /dev/null; then
    echo "uv already installed..."
else
    echo "installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# DEFAULT_NVM_DIR determined the same way the nvm installer does it
# https://github.com/nvm-sh/nvm?tab=readme-ov-file#install--update-script
DEFAULT_NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
export NVM_DIR=${NVM_DIR:-$DEFAULT_NVM_DIR}

if [ -s "$NVM_DIR/nvm.sh" ]; then
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
