#!/bin/bash

set -e  # Exit on any error

echo "========== NIX MULTI-USER INSTALLATION SCRIPT STARTED =========="
echo "Running as user: $(whoami)"

echo "Downloading and installing Nix for Steam Deck..."

if curl -L https://install.determinate.systems/nix | sh -s -- install steam-deck --no-confirm; then
    echo "Nix installation script executed successfully."
else
    echo "Nix installation failed. Exiting."
    exit 1
fi

echo "Verifying Nix installation..."
if command -v nix >/dev/null 2>&1; then
    echo "Nix was successfully installed!"
    nix --version
    echo "========== INSTALLATION COMPLETE =========="
    exit 0
else
    echo "Error: Nix command not found. Installation might have failed."
    exit 1
fi