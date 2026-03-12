FROM apify/actor-node:20

WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . ./

# 3000 = local dev, 4321 = Apify Standby default
EXPOSE 3000 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.ACTOR_STANDBY_PORT||3000;fetch('http://localhost:'+p+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# The actor is started by "npm start" by default if not specified
CMD ["npm", "start"]
