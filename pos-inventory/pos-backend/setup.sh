#!/bin/bash

# POS Backend Setup Script

echo "========================================="
echo "POS Backend Setup"
echo "========================================="

# Check Python version
echo "Checking Python version..."
python3 --version

# Create virtual environment with uv
echo "Creating virtual environment with uv..."
uv venv .venv

# Install dependencies with uv
echo "Installing dependencies..."
uv pip install -r requirements.txt --python .venv/bin/python

# Create .env file from example
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your SAP credentials!"
else
    echo ".env file already exists"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Update SAP Service Layer credentials"
echo "3. Activate the venv: source .venv/bin/activate"
echo "4. Run the application: uvicorn app.main:app --reload --port 8000"
echo ""
echo "API Documentation will be available at:"
echo "  - http://localhost:8000/docs (Swagger UI)"
echo "  - http://localhost:8000/redoc (ReDoc)"
echo ""


echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Update SAP Service Layer credentials"
echo "3. Run the application: uvicorn app.main:app --reload --port 3000"
echo ""
echo "API Documentation will be available at:"
echo "  - http://localhost:3000/docs (Swagger UI)"
echo "  - http://localhost:3000/redoc (ReDoc)"
echo ""
