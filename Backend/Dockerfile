# Use official Node.js image
FROM node:16

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Create Uploads directory
RUN mkdir -p Uploads && chmod 755 Uploads

# Expose the app port
EXPOSE 3221

# Start the app
CMD ["node", "server.js"]
