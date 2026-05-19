/* --- Aura Chords - Lógica Musical y Sintetizador --- */

// 1. Configuración de Notas y Acordes
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTES_SPANISH = {
    'C': 'Do', 'C#': 'Do#', 'D': 'Re', 'D#': 'Re#', 'E': 'Mi', 'F': 'Fa', 'F#': 'Fa#',
    'G': 'Sol', 'G#': 'Sol#', 'A': 'La', 'A#': 'La#', 'B': 'Si'
};

const CHORD_TYPES = {
    major: {
        name: 'Mayor',
        symbol: 'maj',
        formula: '1 - 3 - 5',
        intervals: ['Fundamental', 'Tercera Mayor', 'Quinta Justa'],
        semitones: [0, 4, 7]
    },
    minor: {
        name: 'Menor',
        symbol: 'min',
        formula: '1 - b3 - 5',
        intervals: ['Fundamental', 'Tercera Menor', 'Quinta Justa'],
        semitones: [0, 3, 7]
    },
    dom7: {
        name: 'Séptima de Dominante',
        symbol: '7',
        formula: '1 - 3 - 5 - b7',
        intervals: ['Fundamental', 'Tercera Mayor', 'Quinta Justa', 'Séptima Menor'],
        semitones: [0, 4, 7, 10]
    },
    maj7: {
        name: 'Sept. Mayor',
        symbol: 'maj7',
        formula: '1 - 3 - 5 - 7',
        intervals: ['Fundamental', 'Tercera Mayor', 'Quinta Justa', 'Séptima Mayor'],
        semitones: [0, 4, 7, 11]
    },
    min7: {
        name: 'Sept. Menor',
        symbol: 'm7',
        formula: '1 - b3 - 5 - b7',
        intervals: ['Fundamental', 'Tercera Menor', 'Quinta Justa', 'Séptima Menor'],
        semitones: [0, 3, 7, 10]
    },
    dim: {
        name: 'Disminuido',
        symbol: 'dim',
        formula: '1 - b3 - b5',
        intervals: ['Fundamental', 'Tercera Menor', 'Quinta Disminuida'],
        semitones: [0, 3, 6]
    },
    aug: {
        name: 'Aumentado',
        symbol: 'aug',
        formula: '1 - 3 - #5',
        intervals: ['Fundamental', 'Tercera Mayor', 'Quinta Aumentada'],
        semitones: [0, 4, 8]
    },
    sus4: {
        name: 'Suspendido 4',
        symbol: 'sus4',
        formula: '1 - 4 - 5',
        intervals: ['Fundamental', 'Cuarta Justa', 'Quinta Justa'],
        semitones: [0, 5, 7]
    },
    sus2: {
        name: 'Suspendido 2',
        symbol: 'sus2',
        formula: '1 - 2 - 5',
        intervals: ['Fundamental', 'Segunda Mayor', 'Quinta Justa'],
        semitones: [0, 2, 7]
    }
};

// 2. Estado Global de la Aplicación
let currentRoot = 'C';
let currentType = 'major';
let audioCtx = null;

// 3. Inicialización de la Web Audio API
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Convertir nombre de nota (ej: "C4", "F#5") a frecuencia en Hz
function noteToFrequency(noteName) {
    const notePart = noteName.slice(0, -1);
    const octavePart = parseInt(noteName.slice(-1));
    const noteIndex = CHROMATIC_NOTES.indexOf(notePart);
    
    // El MIDI 60 corresponde a C4
    const midiNumber = 12 * (octavePart + 1) + noteIndex;
    
    // Ecuación de frecuencia basada en afinación estándar A4 = 440Hz (MIDI 69)
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

// 4. Síntesis de Sonido Polifónica y Monofónica
function playTone(frequency, startTime, duration, isChord = false) {
    if (!audioCtx) return null;
    
    // Crear oscilador y ganancia
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    // Tipo de onda cálida para piano/sintetizador eléctrico
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, startTime);

    // Filtro pasa-bajos para suavizar agudos estridentes
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, startTime);

    // Ajustar volumen del oscilador para evitar distorsiones digitales
    const volume = isChord ? 0.12 : 0.25; 

    // Envolvente de volumen (ADSR suave para evitar clics de audio)
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.04); // Ataque rápido
    gainNode.gain.setValueAtTime(volume, startTime + duration - 0.15); // Sostén
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // Caída/Relajación suave

    // Conexiones de audio
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Iniciar y detener
    osc.start(startTime);
    osc.stop(startTime + duration);

    return osc;
}

// Obtener las notas exactas en el piano que corresponden al acorde actual
function getCurrentChordNotes() {
    const rootIdx = CHROMATIC_NOTES.indexOf(currentRoot);
    const chordInfo = CHORD_TYPES[currentType];
    
    return chordInfo.semitones.map(semitone => {
        // La tónica se coloca siempre en la 4ª octava (C4-B4)
        const midiNumber = 60 + rootIdx + semitone;
        const octave = Math.floor(midiNumber / 12) - 1;
        const noteName = CHROMATIC_NOTES[midiNumber % 12];
        return `${noteName}${octave}`;
    });
}

// 5. Renderizado y Actualización de Interfaz
function updateUI() {
    const rootNameEs = NOTES_SPANISH[currentRoot];
    const chordInfo = CHORD_TYPES[currentType];
    
    // 1. Título e información general
    document.getElementById('chordFullName').textContent = `${rootNameEs} ${chordInfo.name}`;
    document.getElementById('chordSymbolBadge').textContent = `${currentRoot}${chordInfo.symbol}`;
    document.getElementById('chordFormula').textContent = chordInfo.formula;
    document.getElementById('chordIntervals').textContent = chordInfo.intervals.join(', ');

    // 2. Burbujas de Notas
    const notesDisplay = document.getElementById('notesDisplay');
    notesDisplay.innerHTML = '';
    
    const chordNotes = getCurrentChordNotes();
    
    chordNotes.forEach((noteWithOctave, index) => {
        const noteName = noteWithOctave.slice(0, -1);
        const spanishName = NOTES_SPANISH[noteName];
        
        const bubble = document.createElement('div');
        bubble.className = 'note-bubble';
        bubble.style.animationDelay = `${index * 0.05}s`;
        bubble.innerHTML = `${noteName}<span style="font-size: 0.55rem; display: block; font-weight: 400; opacity: 0.8;">${spanishName}</span>`;
        notesDisplay.appendChild(bubble);
    });

    // 3. Iluminar Teclas de Piano
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        const note = key.getAttribute('data-note');
        if (chordNotes.includes(note)) {
            key.classList.add('active');
        } else {
            key.classList.remove('active');
        }
    });
}

// 6. Funciones de Reproducción de Sonido
function playChord() {
    initAudio();
    const chordNotes = getCurrentChordNotes();
    const now = audioCtx.currentTime;
    
    chordNotes.forEach(note => {
        const freq = noteToFrequency(note);
        playTone(freq, now, 1.2, true);
    });
}

function playArpeggio() {
    initAudio();
    const chordNotes = getCurrentChordNotes();
    const now = audioCtx.currentTime;
    
    chordNotes.forEach((note, index) => {
        const freq = noteToFrequency(note);
        const startTime = now + (index * 0.25);
        playTone(freq, startTime, 0.8, false);
        
        // Efecto visual temporal de pulsación de tecla durante el arpegio
        setTimeout(() => {
            const keyEl = document.querySelector(`.key[data-note="${note}"]`);
            if (keyEl) {
                keyEl.classList.add('active-playing');
                setTimeout(() => keyEl.classList.remove('active-playing'), 400);
            }
        }, index * 250);
    });
}

// 7. Configuración de Eventos de Escucha
function setupEventListeners() {
    // Clics en la cuadrícula de Nota Fundamental (Tónica)
    const rootGrid = document.getElementById('rootGrid');
    rootGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.root-btn');
        if (!btn) return;
        
        document.querySelectorAll('.root-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRoot = btn.getAttribute('data-note');
        
        updateUI();
    });

    // Clics en la cuadrícula de Calidad de Acorde
    const chordTypeGrid = document.getElementById('chordTypeGrid');
    chordTypeGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.type-btn');
        if (!btn) return;
        
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.getAttribute('data-type');
        
        updateUI();
    });

    // Botones de acción principales
    document.getElementById('btnPlayChord').addEventListener('click', () => {
        playChord();
    });

    document.getElementById('btnArpeggiate').addEventListener('click', () => {
        playArpeggio();
    });

    // Clics interactivos en las teclas individuales del piano
    const pianoKeyboard = document.getElementById('pianoKeyboard');
    pianoKeyboard.addEventListener('click', (e) => {
        const key = e.target.closest('.key');
        if (!key) return;
        
        initAudio();
        const note = key.getAttribute('data-note');
        const freq = noteToFrequency(note);
        
        // Tocar la nota individualmente
        playTone(freq, audioCtx.currentTime, 0.7, false);
        
        // Animación de tecla tocada
        key.classList.add('active-playing');
        setTimeout(() => {
            key.classList.remove('active-playing');
        }, 150);
    });
}

// 8. Carga e Inicialización de la Aplicación
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateUI();
});
