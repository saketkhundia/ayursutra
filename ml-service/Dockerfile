# ML Service - Python 3.11
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/health')"

ENV FLASK_APP=app.py
ENV FLASK_ENV=production
EXPOSE 5000

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0"]
