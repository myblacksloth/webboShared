# 📁 WebbòShared

Applicazione web per la **condivisione di file** tramite stanze. Semplice, senza autenticazione, pronta all'uso.

## Funzionalità

- **Crea stanze**: ogni utente può creare stanze per organizzare i file
- **Visualizza stanze**: tutti gli utenti vedono le stanze disponibili
- **Carica file**: all'interno di una stanza è possibile caricare file (fino a 500 MB)
- **Scarica file**: i file caricati possono essere scaricati da chiunque
- **Elimina file**: i file possono essere eliminati singolarmente
- **Elimina stanze**: eliminando una stanza vengono eliminati anche tutti i file contenuti

## Tecnologie

- **Backend**: Node.js + Express
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Upload file**: Multer
- **Container**: Docker + Docker Compose

## Configurazione

L'applicazione è configurabile tramite **variabili d'ambiente**:

| Variabile   | Descrizione                                  | Default            |
|-------------|----------------------------------------------|--------------------|
| `PORT`      | Porta HTTP su cui il server è in ascolto     | `3000`             |
| `DATA_DIR`  | Percorso della directory per salvare i file  | `./data`           |

---

## Avvio in locale

### Prerequisiti

- [Node.js](https://nodejs.org/) versione 18 o superiore

### Passi

1. **Entra nella cartella del progetto**:

   ```bash
   cd webboshared
   ```

2. **Installa le dipendenze**:

   ```bash
   npm install
   ```

3. **(Opzionale) Configura le variabili d'ambiente**:

   Copia il file di esempio e modificalo secondo le tue esigenze:

   ```bash
   cp .env.example .env
   ```

   Oppure esporta direttamente le variabili:

   ```bash
   export PORT=8080
   export DATA_DIR=/percorso/personalizzato/dati
   ```

   Su Windows (PowerShell):

   ```powershell
   $env:PORT = "8080"
   $env:DATA_DIR = "C:\percorso\personalizzato\dati"
   ```

4. **Avvia l'applicazione**:

   ```bash
   npm start
   ```

5. **Apri il browser** su [http://localhost:3000](http://localhost:3000) (o la porta configurata).

### Arresto

Premi `Ctrl+C` nel terminale dove gira il server.

---

## Avvio con Docker

### Prerequisiti

- [Docker](https://www.docker.com/) e Docker Compose installati

### Passi

1. **Dalla directory principale del progetto** (quella che contiene `docker-compose-yaml`):

   ```bash
   docker compose -f docker-compose-yaml up -d --build
   ```

   Questo comando:
   - Costruisce l'immagine Docker dal Dockerfile
   - Avvia il container in background
   - Mappa la porta 3000 sull'host
   - Crea un volume Docker per la persistenza dei dati

2. **Apri il browser** su [http://localhost:3000](http://localhost:3000).

### Personalizzazione porta e percorso dati

Modifica il file `docker-compose-yaml` per cambiare porta o percorso:

```yaml
ports:
  - "8080:3000"   # Espone sulla porta 8080 dell'host
```

Per montare una directory specifica dell'host invece del volume Docker:

```yaml
volumes:
  - /percorso/host/dati:/data/webboshared/data
```

### Arresto

```bash
docker compose -f docker-compose-yaml down
```

### Arresto con eliminazione dei dati

```bash
docker compose -f docker-compose-yaml down -v
```

---

## Struttura del progetto

```
webboshared/
├── docker-compose-yaml          # Configurazione Docker Compose
├── README.md                    # Questo file
└── webboshared/
    ├── Dockerfile               # Definizione immagine Docker
    ├── .dockerignore            # File ignorati nella build Docker
    ├── .env.example             # Esempio di configurazione
    ├── package.json             # Dipendenze Node.js
    └── src/
        ├── server.js            # Server Express (API REST)
        └── public/
            ├── index.html       # Pagina HTML principale
            ├── style.css        # Foglio di stile
            └── app.js           # Logica frontend
```
