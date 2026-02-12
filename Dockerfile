FROM node:22-slim

# Install Python for sentiment service
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install Python dependencies
COPY sentiment_service/requirements.txt ./sentiment_service/
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r sentiment_service/requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start script: launches both Python sentiment service and Node.js server
CMD bash -c "/app/venv/bin/python sentiment_service/app.py & sleep 3 && node app.js"
