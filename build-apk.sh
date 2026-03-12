#!/bin/bash

# Visyra CRM - APK Build Script
# This script automates the APK building process

echo "🚀 Visyra CRM - APK Build Automation"
echo "======================================"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null
then
    echo "📦 EAS CLI not found. Installing..."
    npm install -g eas-cli
    echo "✅ EAS CLI installed"
else
    echo "✅ EAS CLI already installed"
fi

# Navigate to frontend directory
cd /app/frontend

echo ""
echo "🔐 Step 1: Login to Expo"
echo "------------------------"
echo "Please login with your Expo account:"
eas login

echo ""
echo "🏗️  Step 2: Configure Build"
echo "------------------------"
echo "Checking build configuration..."

if [ -f "eas.json" ]; then
    echo "✅ eas.json found"
else
    echo "⚠️  eas.json not found, creating..."
    eas build:configure
fi

echo ""
echo "📱 Step 3: Build APK"
echo "------------------------"
echo "Select build profile:"
echo "  1) Preview (Recommended for testing)"
echo "  2) Production (Final release)"
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo "Building Preview APK..."
        eas build --platform android --profile preview
        ;;
    2)
        echo "Building Production APK..."
        eas build --platform android --profile production
        ;;
    *)
        echo "Invalid choice. Building Preview APK..."
        eas build --platform android --profile preview
        ;;
esac

echo ""
echo "✅ Build process started!"
echo ""
echo "📝 Next Steps:"
echo "1. Wait for build to complete (~15 minutes)"
echo "2. Download APK from the link provided"
echo "3. Transfer to your Android tablet"
echo "4. Install the APK"
echo "5. Launch Visyra CRM!"
echo ""
echo "📊 Check build status at: https://expo.dev"
echo ""
