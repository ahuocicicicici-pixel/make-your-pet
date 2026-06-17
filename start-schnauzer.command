#!/bin/zsh
cd "$(dirname "$0")" || exit 1

echo "Starting Schnauzer Pet..."
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed yet."
  echo "Please install Node.js LTS from https://nodejs.org/ first."
  echo
  read "unused?Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing app files. This may take a few minutes..."
  npm install || {
    echo
    echo "Install failed. Please check the network and try again."
    read "unused?Press Enter to close..."
    exit 1
  }
fi

echo
echo "Launching Schnauzer Pet..."
npm start
