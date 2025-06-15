#!/bin/bash

set -e  # Exit on any error
LOGFILE="/home/deck/nix.log"

# Ensure we start fresh
echo "========== NIX INSTALL LOG ==========" > "$LOGFILE"
echo "Timestamp: $(date)" >> "$LOGFILE"
echo "Running as user: $(whoami)" | tee -a "$LOGFILE"

echo "Downloading and installing Nix for Steam Deck..." | tee -a "$LOGFILE"

# Pipe curl and installer output to log
if curl -L https://install.determinate.systems/nix | \
   sh -s -- install steam-deck --no-confirm --verbose 2>&1 | tee -a "$LOGFILE"; then
    echo "Nix installation script executed successfully." | tee -a "$LOGFILE"
else
    echo "Nix installation failed. Exiting." | tee -a "$LOGFILE"
    exit 1
fi

# Verify nix binary presence
echo "Verifying Nix installation..." | tee -a "$LOGFILE"
if command -v nix >/dev/null 2>&1; then
    echo "Nix was successfully installed!" | tee -a "$LOGFILE"
    nix --version | tee -a "$LOGFILE"
    echo "========== INSTALLATION COMPLETE ==========" | tee -a "$LOGFILE"
    exit 0
else
    echo "Error: Nix command not found. Installation might have failed." | tee -a "$LOGFILE"
    exit 1
fi