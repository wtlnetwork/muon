#!/bin/bash
set -e

TIMESTAMP=$(date +%s)
LOGFILE="/home/deck/nix_${TIMESTAMP}.log"

# Start fresh
echo "========== NIX INSTALL LOG ==========" > "$LOGFILE"
echo "Timestamp: $(date)" | tee -a "$LOGFILE"
echo "Running as user: $(whoami)" | tee -a "$LOGFILE"
echo "Script path: $0" | tee -a "$LOGFILE"
echo "Current working dir: $(pwd)" | tee -a "$LOGFILE"
echo "Shell: $SHELL" | tee -a "$LOGFILE"
echo "PATH: $PATH" | tee -a "$LOGFILE"
echo "LD_LIBRARY_PATH: $LD_LIBRARY_PATH" | tee -a "$LOGFILE"
echo "HOME: $HOME" | tee -a "$LOGFILE"
echo "UID: $(id -u)" | tee -a "$LOGFILE"
echo "GID: $(id -g)" | tee -a "$LOGFILE"
echo "Groups: $(id -Gn)" | tee -a "$LOGFILE"
echo "Environment variables:" | tee -a "$LOGFILE"
env | sort | tee -a "$LOGFILE"

echo | tee -a "$LOGFILE"
echo "Checking existing nixbld group:" | tee -a "$LOGFILE"
getent group nixbld || echo "nixbld group not found." | tee -a "$LOGFILE"

echo | tee -a "$LOGFILE"
echo "Checking existing nixbld users:" | tee -a "$LOGFILE"
compgen -u | grep nixbld || echo "No nixbld users found." | tee -a "$LOGFILE"

echo | tee -a "$LOGFILE"
echo "Downloading and installing Nix for Steam Deck..." | tee -a "$LOGFILE"


INSTALLER_SCRIPT="/tmp/nix_installer_$$.sh"

echo "Downloading installer to $INSTALLER_SCRIPT..." | tee -a "$LOGFILE"
if curl -fsSL https://install.determinate.systems/nix -o "$INSTALLER_SCRIPT"; then
    chmod +x "$INSTALLER_SCRIPT"
    echo "Running installer script as user 'deck' via sudo..." | tee -a "$LOGFILE"

    if sudo -u deck env -i HOME="/home/deck" USER="deck" PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
       bash --login "$INSTALLER_SCRIPT" install steam-deck --no-confirm --verbose 2>&1 | tee -a "$LOGFILE"; then
        echo "Nix installation script executed successfully." | tee -a "$LOGFILE"
    else
        echo "Nix installer script failed during execution." | tee -a "$LOGFILE"
        exit 1
    fi

    rm -f "$INSTALLER_SCRIPT"
else
    echo "Failed to download installer script." | tee -a "$LOGFILE"
    exit 1
fi

echo | tee -a "$LOGFILE"
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