#!/bin/bash

# GitHub Project Setup Script for Menu Familiar Multi-User & Gamification Features
# 
# Prerequisites:
# 1. Create project manually at: https://github.com/luchotourn/menusemanal/projects
# 2. Get the project number from the URL (e.g., projects/5 -> PROJECT_NUMBER=5)
# 3. Run this script with: ./setup-github-project.sh PROJECT_NUMBER

set -e  # Exit on any error

# Check if project number is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the project number"
    echo "Usage: $0 <project_number>"
    echo "Example: $0 5"
    echo ""
    echo "To get the project number:"
    echo "1. Go to https://github.com/luchotourn/menusemanal/projects"
    echo "2. Open your project"
    echo "3. The URL will show: /users/luchotourn/projects/X (where X is the project number)"
    exit 1
fi

PROJECT_NUMBER=$1
REPO="luchotourn/menusemanal"

echo "🚀 Setting up GitHub Project #$PROJECT_NUMBER for Menu Familiar"
echo "📋 Repository: $REPO"
echo ""

# Epic 4: Multi-User & Authentication System Issues
echo "🔐 Adding Epic 4: Multi-User & Authentication System issues..."

echo "  📝 Adding Issue #29: Implement user authentication with Passport.js"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/29"

echo "  📝 Adding Issue #30: Create login and registration UI"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/30"

echo "  📝 Adding Issue #31: Add user profile management"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/31"

echo "  📝 Adding Issue #32: Implement multi-user database schema"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/32"

echo "  📝 Adding Issue #33: Create family management system"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/33"

echo "  📝 Adding Issue #38: Implement role-based permissions and UI"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/38"

# Epic 5: Kids Engagement & Gamification Features Issues
echo ""
echo "⭐ Adding Epic 5: Kids Engagement & Gamification issues..."

echo "  📝 Adding Issue #34: Implement star rating system for kids"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/34"

echo "  📝 Adding Issue #35: Create badge system with progress tracking"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/35"

echo "  📝 Adding Issue #36: Build kid-friendly comment system with emoji reactions"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/36"

echo "  📝 Adding Issue #37: Create parent feedback dashboard with smart insights"
gh project item-add $PROJECT_NUMBER --owner luchotourn --url "https://github.com/$REPO/issues/37"

echo ""
echo "✅ Successfully added all 10 issues to project #$PROJECT_NUMBER!"
echo ""
echo "📋 Next Steps:"
echo "1. Visit: https://github.com/users/luchotourn/projects/$PROJECT_NUMBER"
echo "2. Set up custom fields:"
echo "   - Epic (Single select): Multi-User System, Kids Gamification"
echo "   - Sprint (Single select): Sprint 1-2, Sprint 3-4, Sprint 5-6, Sprint 7-8"
echo "   - Size (Single select): Small, Medium, Large"
echo "3. Create project views:"
echo "   - Sprint Planning (Group by Epic, Filter by Status)"
echo "   - Progress Tracking (Group by Status)"
echo "   - Epic Overview (Group by Epic)"
echo "4. Assign Epic values to each issue"
echo ""
echo "🎯 Ready to start development! Epic 4 issues should be tackled first."