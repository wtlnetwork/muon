#!/bin/bash

set -e  # Exit on any error

echo "========== NIX MULTI-USER INSTALLATION SCRIPT STARTED =========="
echo "Running as user: $(whoami)"

echo "Downloading and installing Nix (multi-user mode)..."
if sh <(curl -L https://nixos.org/nix/install) --daemon; then
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