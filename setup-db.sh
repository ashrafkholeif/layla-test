#!/bin/bash
# Layla v2 - Database Setup Script

set -e

echo "🍽️  Layla v2 - Database Setup"
echo "=============================="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Install it first:"
    echo "   macOS: brew install postgresql@15"
    echo "   Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

echo "✅ PostgreSQL found"
echo ""

# Check if database exists
DBNAME="layla_v2"

if psql -lqt | cut -d \| -f 1 | grep -qw "$DBNAME"; then
    echo "⚠️  Database '$DBNAME' already exists"
    read -p "Drop and recreate? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        dropdb "$DBNAME"
    else
        echo "Using existing database"
    fi
fi

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DBNAME"; then
    echo "Creating database '$DBNAME'..."
    createdb "$DBNAME"
    echo "✅ Database created"
fi

echo ""

# Initialize schema
echo "Initializing schema..."
if [ -f "schema.sql" ]; then
    psql -d "$DBNAME" -f schema.sql
    echo "✅ Schema initialized"
else
    echo "❌ schema.sql not found in current directory"
    exit 1
fi

echo ""

# Verify tables
echo "Verifying tables..."
TABLES=$(psql -d "$DBNAME" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" -t | tr -d ' ')
echo "✅ Created $TABLES tables"

echo ""

# Show database info
echo "Database ready! Connection string:"
echo "postgresql://postgres@localhost:5432/$DBNAME"

echo ""
echo "Add to .env:"
echo "DATABASE_URL=postgresql://postgres@localhost:5432/$DBNAME"

echo ""
echo "🎉 Database setup complete!"
