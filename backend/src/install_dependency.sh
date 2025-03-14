#!/bin/bash

# Ensure a package name is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <package-name>"
    exit 1
fi

PACKAGE=$1

echo "Installing package: $PACKAGE using Nix..."

# Attempt to install the package
if nix-env -iA nixos."$PACKAGE"; then
    echo "Installation command executed successfully."
else
    echo "Error: Failed to install $PACKAGE."
    exit 1
fi

# Verify the package is installed
if nix-env -q | grep -q "^$PACKAGE"; then
    echo "Verification successful: $PACKAGE is installed."
    exit 0
else
    echo "Error: $PACKAGE does not appear to be installed."
    exit 1
fi