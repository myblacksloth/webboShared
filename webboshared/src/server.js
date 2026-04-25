/**
 * WebbòShared - Server principale dell'applicazione di condivisione file.
 *
 * Questo modulo avvia un server Express che gestisce:
 * - La creazione e l'eliminazione di stanze
 * - Il caricamento, la visualizzazione e l'eliminazione di file nelle stanze
 * - La creazione, la visualizzazione e l'eliminazione di snippet di testo nelle stanze
 * - Il servizio dei file statici del frontend
 *
 * La configurazione avviene tramite variabili d'ambiente:
 * - PORT: porta HTTP su cui il server è in ascolto (default: 3000)
 * - DATA_DIR: percorso della directory dove vengono salvati i file (default: ./data)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Configurazione ──────────────────────────────────────────────────────────
// Legge le variabili d'ambiente o usa i valori di default
const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// ── Inizializzazione Express ────────────────────────────────────────────────
const app = express();

// Abilita il parsing del JSON nel body delle richieste
app.use(express.json());

// Serve i file statici del frontend dalla cartella "public"
app.use(express.static(path.join(__dirname, 'public')));

// ── File di stato (metadati stanze) ─────────────────────────────────────────
// Il file rooms.json contiene l'elenco delle stanze con i relativi metadati
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

/**
 * Crea la directory dei dati se non esiste e inizializza il file rooms.json.
 */
function inizializzaStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOMS_FILE)) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify([]), 'utf-8');
  }
}

/**
 * Legge l'elenco delle stanze dal file rooms.json.
 * @returns {Array} Array di oggetti stanza
 */
function leggiStanze() {
  try {
    const contenuto = fs.readFileSync(ROOMS_FILE, 'utf-8');
    return JSON.parse(contenuto);
  } catch {
    return [];
  }
}

/**
 * Salva l'elenco delle stanze nel file rooms.json.
 * @param {Array} stanze - Array di oggetti stanza da salvare
 */
function salvaStanze(stanze) {
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(stanze, null, 2), 'utf-8');
}

// ── Gestione snippet di testo ────────────────────────────────────────────
// Ogni stanza ha un file snippets.json nella propria directory

/**
 * Restituisce il percorso del file snippets.json di una stanza.
 * @param {string} idStanza - ID univoco della stanza
 * @returns {string} Percorso del file snippets.json
 */
function percorsoSnippetsStanza(idStanza) {
  return path.join(DATA_DIR, 'rooms', idStanza, '_snippets.json');
}

/**
 * Legge gli snippet di testo di una stanza.
 * @param {string} idStanza - ID univoco della stanza
 * @returns {Array} Array di oggetti snippet
 */
function leggiSnippets(idStanza) {
  const percorso = percorsoSnippetsStanza(idStanza);
  try {
    if (fs.existsSync(percorso)) {
      return JSON.parse(fs.readFileSync(percorso, 'utf-8'));
    }
  } catch { /* ignora errori di parsing */ }
  return [];
}

/**
 * Salva gli snippet di testo di una stanza.
 * @param {string} idStanza - ID univoco della stanza
 * @param {Array} snippets - Array di oggetti snippet da salvare
 */
function salvaSnippets(idStanza, snippets) {
  const dirStanza = path.join(DATA_DIR, 'rooms', idStanza);
  if (!fs.existsSync(dirStanza)) {
    fs.mkdirSync(dirStanza, { recursive: true });
  }
  fs.writeFileSync(percorsoSnippetsStanza(idStanza), JSON.stringify(snippets, null, 2), 'utf-8');
}

/**
 * Restituisce l'elenco dei file presenti nella directory di una stanza.
 * @param {string} idStanza - ID univoco della stanza
 * @returns {Array} Array di oggetti con nome e dimensione del file
 */
function leggiFileStanza(idStanza) {
  const dirStanza = path.join(DATA_DIR, 'rooms', idStanza);
  if (!fs.existsSync(dirStanza)) {
    return [];
  }
  // Legge i file nella directory della stanza (escludendo il file interno _snippets.json)
  return fs.readdirSync(dirStanza)
    .filter((nomeFile) => nomeFile !== '_snippets.json')
    .map((nomeFile) => {
      const percorsoFile = path.join(dirStanza, nomeFile);
      const stats = fs.statSync(percorsoFile);
      return {
        nome: nomeFile,
        dimensione: stats.size,
        dataModifica: stats.mtime.toISOString(),
      };
    });
}

/**
 * Elimina ricorsivamente una directory e tutto il suo contenuto.
 * @param {string} percorso - Percorso della directory da eliminare
 */
function eliminaDirectoryRicorsiva(percorso) {
  if (fs.existsSync(percorso)) {
    fs.rmSync(percorso, { recursive: true, force: true });
  }
}

// ── Configurazione Multer per l'upload dei file ─────────────────────────────
// Multer salva i file nella sottocartella della stanza corrispondente
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const idStanza = req.params.idStanza;
    // Validazione dell'ID stanza per prevenire path traversal
    if (!idStanza || /[^a-zA-Z0-9\-]/.test(idStanza)) {
      return cb(new Error('ID stanza non valido'));
    }
    const dirStanza = path.join(DATA_DIR, 'rooms', idStanza);
    // Crea la directory della stanza se non esiste ancora
    if (!fs.existsSync(dirStanza)) {
      fs.mkdirSync(dirStanza, { recursive: true });
    }
    cb(null, dirStanza);
  },
  filename: (_req, file, cb) => {
    // Sanitizza il nome del file originale rimuovendo caratteri pericolosi
    const nomeSanitizzato = file.originalname.replace(/[^a-zA-Z0-9._\-\s()àèéìòù]/g, '_');
    cb(null, nomeSanitizzato);
  },
});

// Limita la dimensione massima del file a 500 MB
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

// ── API REST ────────────────────────────────────────────────────────────────

/**
 * GET /api/stanze
 * Restituisce l'elenco di tutte le stanze con il conteggio dei file.
 */
app.get('/api/stanze', (_req, res) => {
  const stanze = leggiStanze();
  // Arricchisce ogni stanza con il numero di file contenuti
  const stanzeConConteggio = stanze.map((stanza) => ({
    ...stanza,
    numeroFile: leggiFileStanza(stanza.id).length,
    numeroSnippet: leggiSnippets(stanza.id).length,
  }));
  res.json(stanzeConConteggio);
});

/**
 * POST /api/stanze
 * Crea una nuova stanza. Richiede un campo "nome" nel body JSON.
 */
app.post('/api/stanze', (req, res) => {
  const { nome } = req.body;

  // Il nome della stanza è obbligatorio
  if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
    return res.status(400).json({ errore: 'Il nome della stanza è obbligatorio.' });
  }

  // Limita la lunghezza del nome a 100 caratteri
  if (nome.trim().length > 100) {
    return res.status(400).json({ errore: 'Il nome della stanza non può superare i 100 caratteri.' });
  }

  const stanze = leggiStanze();

  // Genera un ID univoco per la nuova stanza
  const nuovaStanza = {
    id: uuidv4(),
    nome: nome.trim(),
    dataCreazione: new Date().toISOString(),
  };

  stanze.push(nuovaStanza);
  salvaStanze(stanze);

  // Crea la directory fisica per i file della stanza
  const dirStanza = path.join(DATA_DIR, 'rooms', nuovaStanza.id);
  fs.mkdirSync(dirStanza, { recursive: true });

  res.status(201).json(nuovaStanza);
});

/**
 * DELETE /api/stanze/:idStanza
 * Elimina una stanza e tutti i file in essa contenuti.
 */
app.delete('/api/stanze/:idStanza', (req, res) => {
  const { idStanza } = req.params;

  // Validazione dell'ID per prevenire path traversal
  if (/[^a-zA-Z0-9\-]/.test(idStanza)) {
    return res.status(400).json({ errore: 'ID stanza non valido.' });
  }

  let stanze = leggiStanze();
  const indice = stanze.findIndex((s) => s.id === idStanza);

  // Verifica che la stanza esista
  if (indice === -1) {
    return res.status(404).json({ errore: 'Stanza non trovata.' });
  }

  // Rimuove la stanza dall'elenco
  stanze.splice(indice, 1);
  salvaStanze(stanze);

  // Elimina la directory della stanza con tutti i file contenuti
  const dirStanza = path.join(DATA_DIR, 'rooms', idStanza);
  eliminaDirectoryRicorsiva(dirStanza);

  res.json({ messaggio: 'Stanza eliminata con successo.' });
});

/**
 * GET /api/stanze/:idStanza/file
 * Restituisce l'elenco dei file presenti in una stanza.
 */
app.get('/api/stanze/:idStanza/file', (req, res) => {
  const { idStanza } = req.params;

  // Validazione dell'ID per prevenire path traversal
  if (/[^a-zA-Z0-9\-]/.test(idStanza)) {
    return res.status(400).json({ errore: 'ID stanza non valido.' });
  }

  const stanze = leggiStanze();
  const stanza = stanze.find((s) => s.id === idStanza);

  if (!stanza) {
    return res.status(404).json({ errore: 'Stanza non trovata.' });
  }

  const file = leggiFileStanza(idStanza);
  const snippets = leggiSnippets(idStanza);
  res.json({ stanza, file, snippets });
});

/**
 * POST /api/stanze/:idStanza/file
 * Carica un file nella stanza specificata.
 */
app.post('/api/stanze/:idStanza/file', (req, res) => {
  const { idStanza } = req.params;

  // Validazione dell'ID per prevenire path traversal
  if (/[^a-zA-Z0-9\-]/.test(idStanza)) {
    return res.status(400).json({ errore: 'ID stanza non valido.' });
  }

  const stanze = leggiStanze();
  const stanza = stanze.find((s) => s.id === idStanza);

  if (!stanza) {
    return res.status(404).json({ errore: 'Stanza non trovata.' });
  }

  // Esegue l'upload del file usando multer
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ errore: 'Il file supera la dimensione massima consentita (500 MB).' });
      }
      return res.status(500).json({ errore: `Errore durante il caricamento: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ errore: 'Nessun file selezionato.' });
    }

    res.status(201).json({
      messaggio: 'File caricato con successo.',
      file: {
        nome: req.file.filename,
        dimensione: req.file.size,
      },
    });
  });
});

/**
 * DELETE /api/stanze/:idStanza/file/:nomeFile
 * Elimina un file specifico dalla stanza.
 */
app.delete('/api/stanze/:idStanza/file/:nomeFile', (req, res) => {
  const { idStanza, nomeFile } = req.params;

  // Validazione dell'ID per prevenire path traversal
  if (/[^a-zA-Z0-9\-]/.test(idStanza)) {
    return res.status(400).json({ errore: 'ID stanza non valido.' });
  }

  // Validazione del nome file per prevenire path traversal
  if (nomeFile.includes('..') || nomeFile.includes('/') || nomeFile.includes('\\')) {
    return res.status(400).json({ errore: 'Nome file non valido.' });
  }

  const percorsoFile = path.join(DATA_DIR, 'rooms', idStanza, nomeFile);

  // Verifica che il percorso risolto sia dentro la directory della stanza
  const percorsoReale = path.resolve(percorsoFile);
  const dirStanzaReale = path.resolve(path.join(DATA_DIR, 'rooms', idStanza));
  if (!percorsoReale.startsWith(dirStanzaReale + path.sep) && percorsoReale !== dirStanzaReale) {
    return res.status(400).json({ errore: 'Percorso file non valido.' });
  }

  if (!fs.existsSync(percorsoFile)) {
    return res.status(404).json({ errore: 'File non trovato.' });
  }

  // Elimina il file dal disco
  fs.unlinkSync(percorsoFile);
  res.json({ messaggio: 'File eliminato con successo.' });
});

/**
 * GET /api/stanze/:idStanza/file/:nomeFile/scarica
 * Permette di scaricare un file dalla stanza.
 */
app.get('/api/stanze/:idStanza/file/:nomeFile/scarica', (req, res) => {
  const { idStanza, nomeFile } = req.params;

  // Validazione dell'ID per prevenire path traversal
  if (/[^a-zA-Z0-9\-]/.test(idStanza)) {
    return res.status(400).json({ errore: 'ID stanza non valido.' });
  }

  // Validazione del nome file per prevenire path traversal
  if (nomeFile.includes('..') || nomeFile.includes('/') || nomeFile.includes('\\')) {
    return res.status(400).json({ errore: 'Nome file non valido.' });
  }

  const percorsoFile = path.join(DATA_DIR, 'rooms', idStanza, nomeFile);

  // Verifica che il percorso risolto sia dentro la directory della stanza
  const percorsoReale = path.resolve(percorsoFile);
  const dirStanzaReale = path.resolve(path.join(DATA_DIR, 'rooms', idStanza));
  if (!percorsoReale.startsWith(dirStanzaReale + path.sep)) {
    return res.status(400).json({ errore: 'Percorso file non valido.' });
  }

  if (!fs.existsSync(percorsoFile)) {
    return res.status(404).json({ errore: 'File non trovato.' });
  }

  // Invia il file come download
  res.download(percorsoFile, nomeFile);
});

// ── API Snippet di testo ────────────────────────────────────────────────

/**
 * POST /api/stanze/:idStanza/snippet
 * Crea un nuovo snippet di testo nella stanza.
 * Richiede un campo "testo" nel body JSON.
 */
app.post('/api/stanze/:idStanza/snippet', (req, res) => {
  const { idStanza } = req.params;

  // Validazione dell'ID per prevenire path traversal
  if (/[^a-zA-Z0-9\-]/.test(idStanza)) {
    return res.status(400).json({ errore: 'ID stanza non valido.' });
  }

  const stanze = leggiStanze();
  const stanza = stanze.find((s) => s.id === idStanza);

  if (!stanza) {
    return res.status(404).json({ errore: 'Stanza non trovata.' });
  }

  const { testo, titolo } = req.body;

  // Il testo dello snippet è obbligatorio
  if (!testo || typeof testo !== 'string' || testo.trim().length === 0) {
    return res.status(400).json({ errore: 'Il testo dello snippet è obbligatorio.' });
  }

  // Limita la dimensione del testo a 100.000 caratteri
  if (testo.length > 100000) {
    return res.status(400).json({ errore: 'Lo snippet non può superare i 100.000 caratteri.' });
  }

  const snippets = leggiSnippets(idStanza);

  // Crea il nuovo snippet con ID univoco e timestamp
  const nuovoSnippet = {
    id: uuidv4(),
    titolo: (titolo && typeof titolo === 'string') ? titolo.trim().substring(0, 100) : '',
    testo: testo,
    dataCreazione: new Date().toISOString(),
  };

  snippets.push(nuovoSnippet);
  salvaSnippets(idStanza, snippets);

  res.status(201).json(nuovoSnippet);
});

/**
 * DELETE /api/stanze/:idStanza/snippet/:idSnippet
 * Elimina uno snippet di testo dalla stanza.
 */
app.delete('/api/stanze/:idStanza/snippet/:idSnippet', (req, res) => {
  const { idStanza, idSnippet } = req.params;

  // Validazione degli ID per prevenire abusi
  if (/[^a-zA-Z0-9\-]/.test(idStanza) || /[^a-zA-Z0-9\-]/.test(idSnippet)) {
    return res.status(400).json({ errore: 'ID non valido.' });
  }

  const stanze = leggiStanze();
  const stanza = stanze.find((s) => s.id === idStanza);

  if (!stanza) {
    return res.status(404).json({ errore: 'Stanza non trovata.' });
  }

  let snippets = leggiSnippets(idStanza);
  const indice = snippets.findIndex((s) => s.id === idSnippet);

  if (indice === -1) {
    return res.status(404).json({ errore: 'Snippet non trovato.' });
  }

  // Rimuove lo snippet dall'elenco e salva
  snippets.splice(indice, 1);
  salvaSnippets(idStanza, snippets);

  res.json({ messaggio: 'Snippet eliminato con successo.' });
});

// ── Fallback: route non trovate ─────────────────────────────────────────────
// Qualsiasi altra richiesta viene servita con l'index.html (SPA)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Avvio del server ────────────────────────────────────────────────────────
inizializzaStorage();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║       WebbòShared - Condivisione File        ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Server avviato su: http://localhost:${PORT}     ║`);
  console.log(`║  Directory dati:    ${DATA_DIR}`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
