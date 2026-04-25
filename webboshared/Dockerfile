# ═══════════════════════════════════════════════════════════════════════════
# WebbòShared - Dockerfile
# Costruisce l'immagine Docker per l'applicazione di condivisione file.
# ═══════════════════════════════════════════════════════════════════════════

# Usa Node.js 20 Alpine come immagine base (leggera e sicura)
FROM node:20-alpine

# Crea la directory di lavoro all'interno del container
WORKDIR /app

# Copia prima solo i file di dipendenze per sfruttare la cache dei layer Docker
COPY package.json ./

# Installa le dipendenze di produzione
RUN npm install --omit=dev

# Copia il codice sorgente dell'applicazione
COPY src/ ./src/

# Crea la directory per i dati (verrà montata come volume)
RUN mkdir -p /data/webboshared/data

# Variabili d'ambiente di default per il funzionamento in Docker
ENV PORT=3000
ENV DATA_DIR=/data/webboshared/data

# Espone la porta HTTP su cui il server è in ascolto
EXPOSE 3000

# Comando di avvio dell'applicazione
CMD ["node", "src/server.js"]
