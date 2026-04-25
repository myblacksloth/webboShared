/**
 * WebbòShared - Logica frontend dell'applicazione.
 *
 * Gestisce l'interazione dell'utente con l'interfaccia:
 * - Visualizzazione e creazione delle stanze
 * - Navigazione dentro una stanza
 * - Upload, download ed eliminazione dei file
 * - Creazione, copia ed eliminazione degli snippet di testo
 * - Eliminazione delle stanze
 */

// ── Riferimenti agli elementi del DOM ───────────────────────────────────────
const vistaStanze = document.getElementById('vista-stanze');
const vistaStanza = document.getElementById('vista-stanza');
const elencoStanze = document.getElementById('elenco-stanze');
const formCreaStanza = document.getElementById('form-crea-stanza');
const inputNomeStanza = document.getElementById('input-nome-stanza');
const btnTornaIndietro = document.getElementById('btn-torna-indietro');
const nomeStanzaCorrente = document.getElementById('nome-stanza-corrente');
const infoStanzaCorrente = document.getElementById('info-stanza-corrente');
const btnEliminaStanza = document.getElementById('btn-elimina-stanza');
const formUploadFile = document.getElementById('form-upload-file');
const inputFile = document.getElementById('input-file');
const elencoFile = document.getElementById('elenco-file');
const contenitoreProgresso = document.getElementById('contenitore-progresso');
const barraProgressoRiempimento = document.getElementById('barra-progresso-riempimento');
const testoProgresso = document.getElementById('testo-progresso');
const toastElement = document.getElementById('toast');
const formCreaSnippet = document.getElementById('form-crea-snippet');
const inputTitoloSnippet = document.getElementById('input-titolo-snippet');
const inputTestoSnippet = document.getElementById('input-testo-snippet');
const elencoSnippet = document.getElementById('elenco-snippet');

// ID della stanza attualmente visualizzata
let idStanzaCorrente = null;

// ── Utilità ─────────────────────────────────────────────────────────────────

/**
 * Formatta una dimensione in byte in una stringa leggibile (KB, MB, GB).
 * @param {number} byte - Dimensione in byte
 * @returns {string} Dimensione formattata
 */
function formattaDimensione(byte) {
  if (byte === 0) return '0 B';
  const unita = ['B', 'KB', 'MB', 'GB'];
  const indice = Math.floor(Math.log(byte) / Math.log(1024));
  const valore = (byte / Math.pow(1024, indice)).toFixed(1);
  return `${valore} ${unita[indice]}`;
}

/**
 * Formatta una data ISO in formato italiano leggibile.
 * @param {string} dataISO - Data in formato ISO 8601
 * @returns {string} Data formattata
 */
function formattaData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Mostra una notifica toast all'utente.
 * @param {string} messaggio - Testo della notifica
 * @param {string} tipo - 'successo' o 'errore'
 */
function mostraToast(messaggio, tipo = 'successo') {
  // Rimuove eventuali classi precedenti
  toastElement.className = 'toast';
  toastElement.textContent = messaggio;

  // Aggiunge la classe del tipo e rende visibile il toast
  toastElement.classList.add(tipo === 'errore' ? 'toast-errore' : 'toast-successo');
  toastElement.classList.add('visibile');
  toastElement.classList.remove('nascosto');

  // Nasconde il toast dopo 3 secondi
  setTimeout(() => {
    toastElement.classList.add('nascosto');
    toastElement.classList.remove('visibile');
  }, 3000);
}

/**
 * Escapa i caratteri HTML per prevenire XSS.
 * @param {string} testo - Testo da sanitizzare
 * @returns {string} Testo sicuro per l'inserimento in HTML
 */
function escapaHTML(testo) {
  const div = document.createElement('div');
  div.textContent = testo;
  return div.innerHTML;
}

// ── Gestione delle stanze ───────────────────────────────────────────────────

/**
 * Carica e visualizza l'elenco di tutte le stanze dal server.
 */
async function caricaStanze() {
  try {
    const risposta = await fetch('/api/stanze');
    const stanze = await risposta.json();

    // Se non ci sono stanze, mostra un messaggio informativo
    if (stanze.length === 0) {
      elencoStanze.innerHTML = '<p class="messaggio-vuoto">Nessuna stanza creata. Creane una per iniziare!</p>';
      return;
    }

    // Genera l'HTML per ogni stanza nell'elenco
    elencoStanze.innerHTML = stanze
      .map(
        (stanza) => `
        <div class="elemento-stanza" data-id="${escapaHTML(stanza.id)}" onclick="apriStanza('${escapaHTML(stanza.id)}')">
          <div class="info-stanza-elenco">
            <h3>${escapaHTML(stanza.nome)}</h3>
            <p>Creata il ${formattaData(stanza.dataCreazione)}</p>
          </div>
          <span class="badge-file">${stanza.numeroFile} file · ${stanza.numeroSnippet} snippet</span>
        </div>
      `
      )
      .join('');
  } catch (errore) {
    mostraToast('Errore nel caricamento delle stanze.', 'errore');
    console.error('Errore caricamento stanze:', errore);
  }
}

/**
 * Crea una nuova stanza inviando il nome al server.
 * Viene chiamata dall'invio del form di creazione.
 */
async function creaStanza(evento) {
  evento.preventDefault();

  const nome = inputNomeStanza.value.trim();
  if (!nome) return;

  try {
    const risposta = await fetch('/api/stanze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });

    if (!risposta.ok) {
      const dati = await risposta.json();
      mostraToast(dati.errore || 'Errore nella creazione della stanza.', 'errore');
      return;
    }

    // Pulisce l'input e ricarica l'elenco
    inputNomeStanza.value = '';
    mostraToast('Stanza creata con successo!');
    caricaStanze();
  } catch (errore) {
    mostraToast('Errore di connessione al server.', 'errore');
    console.error('Errore creazione stanza:', errore);
  }
}

/**
 * Apre una stanza e mostra i file contenuti.
 * Cambia la vista dall'elenco stanze alla vista della stanza singola.
 * @param {string} idStanza - ID della stanza da aprire
 */
async function apriStanza(idStanza) {
  idStanzaCorrente = idStanza;

  // Passa dalla vista elenco alla vista stanza singola
  vistaStanze.classList.add('nascosto');
  vistaStanza.classList.remove('nascosto');

  // Carica i dettagli della stanza, i file e gli snippet
  await caricaFileStanza();
}

/**
 * Carica i file di una stanza dal server e li visualizza.
 */
async function caricaFileStanza() {
  try {
    const risposta = await fetch(`/api/stanze/${idStanzaCorrente}/file`);

    if (!risposta.ok) {
      mostraToast('Stanza non trovata.', 'errore');
      tornaAlleStanze();
      return;
    }

    const dati = await risposta.json();

    // Aggiorna il titolo e le info della stanza
    nomeStanzaCorrente.textContent = dati.stanza.nome;
    infoStanzaCorrente.textContent = `Creata il ${formattaData(dati.stanza.dataCreazione)} — ${dati.file.length} file · ${dati.snippets.length} snippet`;

    // Se non ci sono file, mostra un messaggio informativo
    if (dati.file.length === 0) {
      elencoFile.innerHTML = '<p class="messaggio-vuoto">Nessun file caricato in questa stanza.</p>';
    } else {
      // Genera l'HTML per ogni file nella stanza
      elencoFile.innerHTML = dati.file
      .map(
        (file) => `
        <div class="elemento-file">
          <div class="info-file">
            <h4>${escapaHTML(file.nome)}</h4>
            <p>${formattaDimensione(file.dimensione)} — ${formattaData(file.dataModifica)}</p>
          </div>
          <div class="azioni-file">
            <button class="btn btn-piccolo btn-scarica" onclick="scaricaFile('${escapaHTML(encodeURIComponent(file.nome))}')">
              ⬇ Scarica
            </button>
            <button class="btn btn-piccolo btn-pericolo" onclick="eliminaFile('${escapaHTML(encodeURIComponent(file.nome))}')">
              ✕ Elimina
            </button>
          </div>
        </div>
      `
      )
      .join('');
    }

    // ── Snippet di testo ─────────────────────────────────────────────────────
    // Visualizza gli snippet di testo della stanza
    if (dati.snippets.length === 0) {
      elencoSnippet.innerHTML = '<p class="messaggio-vuoto">Nessuno snippet di testo condiviso.</p>';
    } else {
      elencoSnippet.innerHTML = dati.snippets
        .map(
          (snippet) => `
          <div class="elemento-snippet">
            <div class="intestazione-snippet">
              <div class="info-snippet">
                ${snippet.titolo ? `<h4>${escapaHTML(snippet.titolo)}</h4>` : ''}
                <p>${formattaData(snippet.dataCreazione)}</p>
              </div>
              <div class="azioni-snippet">
                <button class="btn btn-piccolo btn-copia" onclick="copiaSnippet('${escapaHTML(snippet.id)}')">
                  📋 Copia
                </button>
                <button class="btn btn-piccolo btn-pericolo" onclick="eliminaSnippet('${escapaHTML(snippet.id)}')">
                  ✕ Elimina
                </button>
              </div>
            </div>
            <pre class="contenuto-snippet" id="snippet-${escapaHTML(snippet.id)}">${escapaHTML(snippet.testo)}</pre>
          </div>
        `
        )
        .join('');
    }
  } catch (errore) {
    mostraToast('Errore nel caricamento dei file.', 'errore');
    console.error('Errore caricamento file:', errore);
  }
}

/**
 * Torna alla vista elenco stanze, uscendo dalla stanza corrente.
 */
function tornaAlleStanze() {
  idStanzaCorrente = null;
  vistaStanza.classList.add('nascosto');
  vistaStanze.classList.remove('nascosto');
  caricaStanze();
}

/**
 * Elimina la stanza corrente dopo conferma dell'utente.
 * Elimina anche tutti i file contenuti nella stanza.
 */
async function eliminaStanza() {
  // Chiede conferma prima di eliminare
  if (!confirm('Sei sicuro di voler eliminare questa stanza e tutto il suo contenuto (file e snippet)?')) {
    return;
  }

  try {
    const risposta = await fetch(`/api/stanze/${idStanzaCorrente}`, {
      method: 'DELETE',
    });

    if (!risposta.ok) {
      const dati = await risposta.json();
      mostraToast(dati.errore || 'Errore nell\'eliminazione della stanza.', 'errore');
      return;
    }

    mostraToast('Stanza eliminata con successo!');
    tornaAlleStanze();
  } catch (errore) {
    mostraToast('Errore di connessione al server.', 'errore');
    console.error('Errore eliminazione stanza:', errore);
  }
}

// ── Gestione dei file ───────────────────────────────────────────────────────

/**
 * Carica un file nella stanza corrente.
 * Usa XMLHttpRequest per mostrare la barra di progresso durante l'upload.
 */
async function caricaFile(evento) {
  evento.preventDefault();

  const file = inputFile.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  // Mostra la barra di progresso
  contenitoreProgresso.classList.remove('nascosto');
  barraProgressoRiempimento.style.width = '0%';
  testoProgresso.textContent = '0%';

  // Usa XMLHttpRequest per monitorare il progresso dell'upload
  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percentuale = Math.round((e.loaded / e.total) * 100);
      barraProgressoRiempimento.style.width = `${percentuale}%`;
      testoProgresso.textContent = `${percentuale}%`;
    }
  });

  xhr.addEventListener('load', () => {
    // Nasconde la barra di progresso
    contenitoreProgresso.classList.add('nascosto');
    inputFile.value = '';

    if (xhr.status === 201) {
      mostraToast('File caricato con successo!');
      caricaFileStanza();
    } else {
      try {
        const dati = JSON.parse(xhr.responseText);
        mostraToast(dati.errore || 'Errore durante il caricamento.', 'errore');
      } catch {
        mostraToast('Errore durante il caricamento.', 'errore');
      }
    }
  });

  xhr.addEventListener('error', () => {
    contenitoreProgresso.classList.add('nascosto');
    mostraToast('Errore di connessione durante il caricamento.', 'errore');
  });

  xhr.open('POST', `/api/stanze/${idStanzaCorrente}/file`);
  xhr.send(formData);
}

/**
 * Avvia il download di un file dalla stanza corrente.
 * @param {string} nomeFileCodificato - Nome del file codificato per URL
 */
function scaricaFile(nomeFileCodificato) {
  // Crea un link temporaneo per avviare il download
  const link = document.createElement('a');
  link.href = `/api/stanze/${idStanzaCorrente}/file/${nomeFileCodificato}/scarica`;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Elimina un file dalla stanza corrente dopo conferma dell'utente.
 * @param {string} nomeFileCodificato - Nome del file codificato per URL
 */
async function eliminaFile(nomeFileCodificato) {
  const nomeFile = decodeURIComponent(nomeFileCodificato);

  if (!confirm(`Sei sicuro di voler eliminare il file "${nomeFile}"?`)) {
    return;
  }

  try {
    const risposta = await fetch(`/api/stanze/${idStanzaCorrente}/file/${nomeFileCodificato}`, {
      method: 'DELETE',
    });

    if (!risposta.ok) {
      const dati = await risposta.json();
      mostraToast(dati.errore || 'Errore nell\'eliminazione del file.', 'errore');
      return;
    }

    mostraToast('File eliminato con successo!');
    caricaFileStanza();
  } catch (errore) {
    mostraToast('Errore di connessione al server.', 'errore');
    console.error('Errore eliminazione file:', errore);
  }
}
// ── Gestione degli snippet di testo ────────────────────────────────────────

/**
 * Crea un nuovo snippet di testo nella stanza corrente.
 */
async function creaSnippet(evento) {
  evento.preventDefault();

  const testo = inputTestoSnippet.value;
  const titolo = inputTitoloSnippet.value.trim();

  if (!testo.trim()) return;

  try {
    const risposta = await fetch(`/api/stanze/${idStanzaCorrente}/snippet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo, titolo }),
    });

    if (!risposta.ok) {
      const dati = await risposta.json();
      mostraToast(dati.errore || 'Errore nella creazione dello snippet.', 'errore');
      return;
    }

    // Pulisce i campi e ricarica la stanza
    inputTestoSnippet.value = '';
    inputTitoloSnippet.value = '';
    mostraToast('Snippet condiviso con successo!');
    caricaFileStanza();
  } catch (errore) {
    mostraToast('Errore di connessione al server.', 'errore');
    console.error('Errore creazione snippet:', errore);
  }
}

/**
 * Copia il contenuto di uno snippet nella clipboard dell'utente.
 * @param {string} idSnippet - ID dello snippet da copiare
 */
async function copiaSnippet(idSnippet) {
  // Trova l'elemento <pre> che contiene il testo dello snippet
  const elemento = document.getElementById(`snippet-${idSnippet}`);
  if (!elemento) return;

  try {
    // Usa l'API Clipboard per copiare il testo
    await navigator.clipboard.writeText(elemento.textContent);
    mostraToast('Testo copiato nella clipboard!');
  } catch {
    // Fallback per browser che non supportano l'API Clipboard
    const selezione = window.getSelection();
    const intervallo = document.createRange();
    intervallo.selectNodeContents(elemento);
    selezione.removeAllRanges();
    selezione.addRange(intervallo);
    document.execCommand('copy');
    selezione.removeAllRanges();
    mostraToast('Testo copiato nella clipboard!');
  }
}

/**
 * Elimina uno snippet di testo dalla stanza corrente dopo conferma.
 * @param {string} idSnippet - ID dello snippet da eliminare
 */
async function eliminaSnippet(idSnippet) {
  if (!confirm('Sei sicuro di voler eliminare questo snippet?')) {
    return;
  }

  try {
    const risposta = await fetch(`/api/stanze/${idStanzaCorrente}/snippet/${idSnippet}`, {
      method: 'DELETE',
    });

    if (!risposta.ok) {
      const dati = await risposta.json();
      mostraToast(dati.errore || 'Errore nell\'eliminazione dello snippet.', 'errore');
      return;
    }

    mostraToast('Snippet eliminato con successo!');
    caricaFileStanza();
  } catch (errore) {
    mostraToast('Errore di connessione al server.', 'errore');
    console.error('Errore eliminazione snippet:', errore);
  }
}
// ── Event Listener ──────────────────────────────────────────────────────────

// Creazione stanza: invio del form
formCreaStanza.addEventListener('submit', creaStanza);

// Torna all'elenco stanze
btnTornaIndietro.addEventListener('click', tornaAlleStanze);

// Eliminazione della stanza corrente
btnEliminaStanza.addEventListener('click', eliminaStanza);

// Upload di un file nella stanza
formUploadFile.addEventListener('submit', caricaFile);

// Creazione di uno snippet di testo nella stanza
formCreaSnippet.addEventListener('submit', creaSnippet);

// ── Inizializzazione ────────────────────────────────────────────────────────
// Carica l'elenco delle stanze all'avvio dell'applicazione
caricaStanze();
