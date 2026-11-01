#!/bin/bash

# ==============================================================================
#  Autonomous GitHub Push Script (v2 - More Robust)
# ==============================================================================
#
#  This script automates the process of pushing a project to a new or
#  existing GitHub repository. It handles dependency checks, authentication,
#  Git initialization, and the final push.
#
#  Usage:
#    1. Make the script executable: chmod +x githubcommit.sh
#    2. Run the script: ./githubcommit.sh (No 'sudo' needed)
#
# ==============================================================================

# Function to print colored and formatted messages
print_message() {
  COLOR=$1
  MESSAGE=$2
  # Print message with a specific color
  # 34=Blue, 32=Green, 33=Yellow, 31=Red
  echo -e "\n\033[${COLOR}m\n==================================================\n${MESSAGE}\n==================================================\033[0m\n"
}

# Exit immediately if any command fails.
set -e

# --- Step 1: Check Prerequisites ---
print_message "34" "Step 1: Checking for Git and GitHub CLI..."

# Check for Git
if ! command -v git &> /dev/null; then
    print_message "31" "Error: Git is not found. Please install Git to proceed.\nFor most systems, you can install it with 'sudo apt-get install git' or 'sudo dnf install git'."
    exit 1
fi

# Check for GitHub CLI (gh)
if ! command -v gh &> /dev/null; then
    print_message "31" "Error: GitHub CLI ('gh') is not found. Please install it from https://cli.github.com/ and run 'gh auth login' before trying again."
    exit 1
fi

print_message "32" "Git and GitHub CLI are ready."

# --- Step 2: Authenticate with GitHub ---
print_message "34" "Step 2: Checking GitHub authentication..."
if ! gh auth status &> /dev/null; then
    print_message "33" "You are not logged into GitHub CLI. Please follow the prompts to authenticate."
    gh auth login
else
    print_message "32" "Successfully authenticated with GitHub."
fi

# --- Step 3: Get User Input ---
print_message "34" "Step 3: Please provide your repository details."
read -p "Enter your GitHub username: " GITHUB_USER
while [[ -z "$GITHUB_USER" ]]; do
  read -p "Username cannot be empty. Please enter your GitHub username: " GITHUB_USER
done

read -p "Enter the desired repository name for this project: " REPO_NAME
while [[ -z "$REPO_NAME" ]]; do
  read -p "Repository name cannot be empty. Please enter a name: " REPO_NAME
done

# --- Step 4: Initialize Git Repository ---
if [ -d ".git" ]; then
    print_message "33" "A .git directory already exists. Skipping 'git init'."
else
    print_message "34" "Initializing a new Git repository..."
    git init -b main
    print_message "32" "Git repository initialized."
fi

# --- Step 4.5: Configure Git Identity ---
print_message "34" "Step 4.5: Checking Git user configuration..."

# Check if user.name is configured
if [[ -z "$(git config user.name)" ]]; then
    print_message "33" "Git user name is not set."
    read -p "Please enter your full name (for Git commits): " GIT_USER_NAME
    while [[ -z "$GIT_USER_NAME" ]]; do
      read -p "Name cannot be empty. Please enter your full name: " GIT_USER_NAME
    done
    git config user.name "$GIT_USER_NAME"
    print_message "32" "Git user name set to '$GIT_USER_NAME' for this repository."
fi

# Check if user.email is configured
if [[ -z "$(git config user.email)" ]]; then
    print_message "33" "Git user email is not set."
    read -p "Please enter your email address (for Git commits): " GIT_USER_EMAIL
    while [[ -z "$GIT_USER_EMAIL" ]]; do
      read -p "Email cannot be empty. Please enter your email address: " GIT_USER_EMAIL
    done
    git config user.email "$GIT_USER_EMAIL"
    print_message "32" "Git user email set to '$GIT_USER_EMAIL' for this repository."
fi

print_message "32" "Git user identity is configured."


# --- Step 5: Add and Commit Files ---
print_message "34" "Step 5: Preparing files for commit..."
git add .

if git diff --staged --quiet; then
    print_message "33" "No new changes to commit. Proceeding to push."
else
    print_message "34" "--> Committing all files..."
    git commit -m "Initial commit: Add project files"
    print_message "32" "Files committed."
fi

# --- Step 6: Create GitHub Repository and Push ---
print_message "34" "Step 6: Creating GitHub repository and pushing code..."
if gh repo view "$GITHUB_USER/$REPO_NAME" >/dev/null 2>&1; then
    print_message "33" "Repository '$GITHUB_USER/$REPO_NAME' already exists on GitHub."
    print_message "34" "--> Pushing to existing repository..."
    git remote rm origin 2>/dev/null || true # Remove old remote if it exists
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
    git push --set-upstream origin main -f # Use -f to force push over existing history if needed
else
    print_message "34" "--> Creating new public repository '$GITHUB_USER/$REPO_NAME'..."
    # Proactively remove any existing 'origin' remote to prevent conflicts
    git remote rm origin 2>/dev/null || true
    gh repo create "$GITHUB_USER/$REPO_NAME" --public --source=. --remote=origin --push
fi

print_message "32" "🚀 Success! Your code has been pushed to GitHub."
print_message "32" "You can view your repository at: https://github.com/$GITHUB_USER/$REPO_NAME"
