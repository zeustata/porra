// api-engine.js
// Motor para calcular los puntos basados en los pronósticos y los resultados reales

const API_KEY = "7588a7d31cb05d8cebc445333011ae30";

// La lista de participantes se cierra el 5 de junio
let allParticipants = [];

// Función principal que inicializa el motor
async function initEngine() {
    try {
        // 1. Cargar pronósticos de los participantes
        const responsePart = await fetch('data/participants.json');
        if (!responsePart.ok) throw new Error('No se pudo cargar participants.json');
        const participants = await responsePart.json();
        allParticipants = participants;
        populateParticipantSelect(participants);
        
        // 2. Conectar a la API real con sistema de caché (60s)
        let realResults = [];
        try {
            const CACHE_KEY = "api_results_cache";
            const CACHE_TIME_KEY = "api_results_cache_time";
            const CACHE_DURATION_MS = 1800000; // 30 minutos
            
            const now = Date.now();
            const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);
            const cachedData = sessionStorage.getItem(CACHE_KEY);
            
            let data = null;

            if (cachedData && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION_MS) {
                // Usar caché
                data = JSON.parse(cachedData);
            } else {
                // Llamar a la API
                const WORLD_CUP_ID = 1; // ID oficial de la Copa del Mundo
                const apiUrl = `https://v3.football.api-sports.io/fixtures?live=all&league=${WORLD_CUP_ID}`;
                
                const responseApi = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        "x-apisports-key": API_KEY
                    }
                });
                data = await responseApi.json();
                
                // Guardar en caché
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
                sessionStorage.setItem(CACHE_TIME_KEY, now.toString());
            }
            
            // Mapeamos los partidos en directo reales
            if (data && data.response && data.response.length > 0) {
                realResults = data.response.map(match => ({
                    matchId: match.fixture.id,
                    homeTeam: match.teams.home.name,
                    awayTeam: match.teams.away.name,
                    homeGoals: match.goals.home || 0,
                    awayGoals: match.goals.away || 0,
                    // Si status.short está entre estos valores, el partido ha finalizado
                    status: ["FT", "AET", "PEN"].includes(match.fixture.status.short) ? "FINISHED" : "LIVE"
                }));
            } else {
                realResults = [];
            }
        } catch (apiError) {
            console.error("Error conectando a la API:", apiError);
            realResults = [];
        }

        // 3. Calcular puntos y pintar en pantalla
        const leaderboard = calculateScores(participants, realResults);
        updateLeaderboardUI(leaderboard);
        
        let nextMatch = null;
        if (realResults.length === 0) {
            nextMatch = await fetchNextMatch();
        }
        updateMatchesUI(realResults, nextMatch);
        
        // 4. Cargar últimas noticias
        fetchNews();

    } catch (error) {
        console.error("Error inicializando el motor:", error);
    }
}

// Función para obtener el próximo partido usando caché de 24 horas (Local Storage)
async function fetchNextMatch() {
    const CACHE_KEY = "wc_fixtures_cache_2026";
    const CACHE_TIME_KEY = "wc_fixtures_cache_time_2026";
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

    const now = Date.now();
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const cachedData = localStorage.getItem(CACHE_KEY);

    let fixtures = [];

    if (cachedData && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION_MS) {
        fixtures = JSON.parse(cachedData);
    } else {
        try {
            const WORLD_CUP_ID = 1;
            const apiUrl = `https://v3.football.api-sports.io/fixtures?league=${WORLD_CUP_ID}&season=2026`;
            const responseApi = await fetch(apiUrl, {
                method: 'GET',
                headers: { "x-apisports-key": API_KEY }
            });
            const data = await responseApi.json();
            
            if (data && data.response) {
                fixtures = data.response;
                localStorage.setItem(CACHE_KEY, JSON.stringify(fixtures));
                localStorage.setItem(CACHE_TIME_KEY, now.toString());
            }
        } catch (e) {
            console.error("Error obteniendo calendario:", e);
        }
    }

    if (!fixtures || fixtures.length === 0) {
        // Fallback simulado si la API aún no devuelve datos para 2026
        return {
            homeTeam: "México",
            awayTeam: "Sudáfrica",
            date: new Date("2026-06-11T20:00:00Z") // UTC: 20:00 -> España: 22:00
        };
    }

    const futureMatches = fixtures.filter(m => new Date(m.fixture.date).getTime() > Date.now());
    if (futureMatches.length > 0) {
        futureMatches.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
        const next = futureMatches[0];
        return {
            homeTeam: next.teams.home.name || "Por Definir",
            awayTeam: next.teams.away.name || "Por Definir",
            date: new Date(next.fixture.date)
        };
    }

    return null;
}

// Lógica matemática para calcular los puntos
function calculateScores(participants, realResults) {
    let leaderboard = [];

    participants.forEach(p => {
        // 1. Puntos de Preguntas Especiales (hasta 100)
        let basePoints = p.predictions.specialPoints || 0;
        let livePoints = 0;

        // 2. Partidos de Fase de Grupos
        if (p.predictions.matches) {
            p.predictions.matches.forEach(pred => {
                const real = realResults.find(r => r.matchId === pred.matchId);
                // ¡AQUÍ ESTÁ LA MAGIA!: Calculamos puntos SOLO si el partido ha terminado
                if (real && real.status === "FINISHED") {
                    let pts = 0;
                    // Signo (1X2) final -> 2 Puntos
                    let realSign = "X", predSign = "X";
                    if (real.homeGoals > real.awayGoals) realSign = "1";
                    if (real.homeGoals < real.awayGoals) realSign = "2";
                    if (pred.homeGoals > pred.awayGoals) predSign = "1";
                    if (pred.homeGoals < pred.awayGoals) predSign = "2";

                    if (predSign === realSign) {
                        pts += 2;
                    }

                    // Goles exactos finales -> 1 Punto por equipo
                    if (pred.homeGoals === real.homeGoals) pts += 1;
                    if (pred.awayGoals === real.awayGoals) pts += 1;
                    
                    basePoints += pts;
                }
            });
        }

        // 3. Clasificación de Grupos (Ejemplo de estructura futura)
        if (p.predictions.groupStandings && realResults.groupStandings) {
            Object.keys(p.predictions.groupStandings).forEach(groupId => {
                const predGroup = p.predictions.groupStandings[groupId]; // ej: ["ESP", "GER", "JPN", "CRC"]
                const realGroup = realResults.groupStandings[groupId];
                if (!realGroup) return; // Evita crash si la API no devuelve info del grupo aún
                
                // Asumimos que los 2 primeros se clasifican (o los que indique la regla del torneo)
                const realClassified = realGroup.slice(0, 2); 
                const predClassified = predGroup.slice(0, 2);

                predClassified.forEach(team => {
                    if (realClassified.includes(team)) {
                        basePoints += 5; // Acertó que el equipo se clasifica
                    }
                });

                predGroup.forEach((team, index) => {
                    if (realGroup[index] === team) {
                        basePoints += 3; // Acertó la posición exacta en el grupo
                    }
                });
            });
        }

        // 4. Fase Eliminatoria (Cruces y Goles)
        if (p.predictions.knockouts && realResults.knockouts) {
            // Ejemplo iterando sobre los partidos eliminatorios
            p.predictions.knockouts.forEach(predMatch => {
                const realMatch = realResults.knockouts.find(r => r.matchId === predMatch.matchId);
                
                // A) Acierto de equipos que llegan a este cruce
                // Si el pronóstico dice que España llega a la Final, y en la realidad España llega a la Final
                if (realMatch && realMatch.homeTeam === predMatch.homeTeam) {
                    basePoints += getPointsForRound(predMatch.round); 
                }
                if (realMatch && realMatch.awayTeam === predMatch.awayTeam) {
                    basePoints += getPointsForRound(predMatch.round);
                }

                // B) Goles exactos en eliminatoria (90 min) -> 10 pts finales
                // Condición: Solo si acertó los dos equipos que jugaban este partido y ha terminado
                if (realMatch && realMatch.status === "FINISHED" && 
                    realMatch.homeTeam === predMatch.homeTeam && 
                    realMatch.awayTeam === predMatch.awayTeam) {
                    
                    if (realMatch.homeGoals === predMatch.homeGoals && realMatch.awayGoals === predMatch.awayGoals) {
                        basePoints += 10;
                    }
                }
            });
        }

        // 5. Premios Finales
        if (p.predictions.finalAwards && realResults.finalAwards) {
            if (p.predictions.finalAwards.champion === realResults.finalAwards.champion) basePoints += 50;
            if (p.predictions.finalAwards.thirdPlace === realResults.finalAwards.thirdPlace) basePoints += 25;
        }
        
        let totalPoints = basePoints + livePoints;
        leaderboard.push({ name: p.name, points: totalPoints, basePoints: basePoints, livePoints: livePoints });
    });

    // Ordenar de mayor a menor
    leaderboard.sort((a, b) => b.points - a.points);
    return leaderboard;
}

function getPointsForRound(roundName) {
    switch(roundName) {
        case 'Octavos': return 5;
        case 'Cuartos': return 10;
        case 'Semifinales': return 15;
        case 'TercerPuesto': return 25;
        case 'Final': return 20;
        case 'Finalista': return 30; // Si se gestiona como premio separado
        default: return 0;
    }
}

// Variables globales para el estado de la tabla
let showFullLeaderboard = false;
let lastLeaderboard = [];

window.toggleLeaderboard = function() {
    showFullLeaderboard = !showFullLeaderboard;
    updateLeaderboardUI(lastLeaderboard);
};

// Actualizar el DOM
function updateLeaderboardUI(leaderboard) {
    lastLeaderboard = leaderboard;
    const list = document.getElementById('leaderboard-list');
    const btnVerCompleta = document.getElementById('btn-ver-completa');
    if (!list) return;

    list.innerHTML = '';
    
    if (leaderboard.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Aún no hay participantes (cierre el 5 de junio).</p>';
        if (btnVerCompleta) btnVerCompleta.style.display = 'none';
        return;
    }
    
    let itemsToShow = showFullLeaderboard ? leaderboard : leaderboard.slice(0, 5);
    
    if (leaderboard.length > 5) {
        if (btnVerCompleta) {
            btnVerCompleta.style.display = 'block';
            btnVerCompleta.innerText = showFullLeaderboard ? 'Ver Menos' : 'Ver Completa';
        }
    } else {
        if (btnVerCompleta) btnVerCompleta.style.display = 'none';
    }

    itemsToShow.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.padding = '10px 0';
        item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';
        else medal = `${index + 1}. `;

        let pointsHtml = `<strong style="color:var(--neon-cyan)">${p.basePoints} pts</strong>`;
        if (p.livePoints > 0) {
            pointsHtml = `<strong style="color:var(--neon-cyan)">${p.basePoints}</strong> <strong style="color:var(--neon-gold); font-size: 0.9em; animation: pulse 1.5s infinite;">+${p.livePoints} live 🔴</strong>`;
        }

        item.innerHTML = `<span>${medal}${p.name}</span> <span>${pointsHtml}</span>`;
        list.appendChild(item);
    });
}

function updateMatchesUI(matches, nextMatch = null) {
    const container = document.getElementById('matches-container');
    if (!container) return;

    // Limpiar intervalo anterior para que no haya relojes fantasma
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    container.innerHTML = '';
    
    if (matches.length > 0) {
        matches.forEach(m => {
            const matchDiv = document.createElement('div');
            matchDiv.style.background = 'rgba(0,0,0,0.3)';
            matchDiv.style.padding = '10px';
            matchDiv.style.borderRadius = '8px';
            matchDiv.style.marginBottom = '10px';
            matchDiv.style.display = 'flex';
            matchDiv.style.justifyContent = 'space-between';
            matchDiv.style.alignItems = 'center';

            let middleContent = '';
            if (m.status === "LIVE") {
                middleContent = `<span style="background:var(--neon-gold); padding:5px 15px; border-radius:15px; font-weight:bold; color:black; animation: pulse 1.5s infinite;">EN JUEGO</span>`;
            } else {
                middleContent = `<span style="background:var(--neon-magenta); padding:5px 15px; border-radius:15px; font-weight:bold;">${m.homeGoals} - ${m.awayGoals}</span>`;
            }

            matchDiv.innerHTML = `
                <span style="flex:1; text-align:right;">${m.homeTeam}</span>
                <div style="flex:1; display:flex; justify-content:center;">${middleContent}</div>
                <span style="flex:1; text-align:left;">${m.awayTeam}</span>
            `;
            container.appendChild(matchDiv);
        });
    } else if (nextMatch) {
        const matchDiv = document.createElement('div');
        matchDiv.style.background = 'rgba(0,0,0,0.3)';
        matchDiv.style.padding = '15px';
        matchDiv.style.borderRadius = '8px';
        matchDiv.style.textAlign = 'center';
        
        // Conversión a la hora local del navegador (Península/Canarias)
        const localTimeStr = nextMatch.date.toLocaleString('es-ES', { 
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
        });

        matchDiv.innerHTML = `
            <p style="color:var(--text-muted); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Siguiente Partido (${localTimeStr})</p>
            <div style="display:flex; justify-content:center; align-items:center; gap: 15px; margin-bottom: 12px; font-weight: bold; font-size: 1.2rem;">
                <span>${nextMatch.homeTeam}</span>
                <span style="color:var(--neon-magenta); font-size: 0.9rem;">VS</span>
                <span>${nextMatch.awayTeam}</span>
            </div>
            <div id="countdown-timer" style="font-family: monospace; font-size: 1.8rem; color: var(--neon-cyan); letter-spacing: 2px; text-shadow: 0 0 15px rgba(0,242,254,0.6);">
                --:--:--:--
            </div>
        `;
        container.appendChild(matchDiv);

        const timerEl = document.getElementById('countdown-timer');
        
        function updateTimer() {
            const now = new Date().getTime();
            const distance = nextMatch.date.getTime() - now;

            if (distance < 0) {
                timerEl.innerHTML = "¡PARTIDO EN JUEGO!";
                clearInterval(window.countdownInterval);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerEl.innerHTML = `${days}d ${hours.toString().padStart(2,'0')}h ${minutes.toString().padStart(2,'0')}m ${seconds.toString().padStart(2,'0')}s`;
        }

        updateTimer(); // Primera ejecución inmediata
        window.countdownInterval = setInterval(updateTimer, 1000);

    } else {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Esperando a que empiece el Mundial...</p>';
    }
}

// Iniciar al cargar la página y configurar actualización automática (polling)
window.addEventListener('DOMContentLoaded', () => {
    initEngine(); // Primera carga inmediata
    
    // Configurar actualización en tiempo real cada 30 minutos (1800000 ms) para proteger cuota de API
    setInterval(initEngine, 1800000);
});

// --- Lógica del Buscador de Pronósticos ---
function populateParticipantSelect(participants) {
    const select = document.getElementById('participant-select');
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona un participante...</option>';
    
    participants.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        showParticipantPredictions(e.target.value);
    });
}

function showParticipantPredictions(participantId) {
    const container = document.getElementById('participant-predictions');
    if (!container) return;

    if (!participantId) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size: 0.9rem;">Elige alguien para ver sus apuestas</p>';
        return;
    }

    const p = allParticipants.find(p => p.id == participantId);
    if (!p || !p.predictions || !p.predictions.matches) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No hay pronósticos disponibles.</p>';
        return;
    }

    // BLOQUEO ANTI-SNOOP: 6 de Junio de 2026 (00:00)
    const deadline = new Date("2026-06-06T00:00:00Z");
    if (new Date() < deadline) {
        container.innerHTML = `
            <div style="background: rgba(255,0,127,0.1); padding: 15px; border-radius: 8px; border: 1px solid var(--neon-magenta); text-align:center;">
                <p style="color:var(--neon-magenta); font-size: 1.2rem; margin-bottom: 5px;">🔒 Pronósticos Ocultos</p>
                <p style="color:var(--text-muted); font-size: 0.85rem;">Para evitar trampas, los pronósticos no serán públicos hasta que finalice el periodo de inscripción (6 de Junio).</p>
            </div>
        `;
        return;
    }

    let html = '';
    p.predictions.matches.forEach(m => {
        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                <span>${m.homeTeam}</span>
                <span style="color:var(--neon-cyan); font-weight:bold;">${m.homeGoals} - ${m.awayGoals}</span>
                <span>${m.awayTeam}</span>
            </div>
        `;
    });
    
    html += `<div style="text-align:center; margin-top:10px; font-size:0.85rem; color:var(--text-muted);">Puntos especiales: ${p.predictions.specialPoints || 0}</div>`;

    container.innerHTML = html;
}

// --- Lógica de Noticias RSS ---
async function fetchNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    try {
        const CACHE_KEY = "wc_news_cache";
        const CACHE_TIME_KEY = "wc_news_cache_time";
        const CACHE_DURATION_MS = 3600000; // 1 hora
        const now = Date.now();
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const cachedData = localStorage.getItem(CACHE_KEY);

        if (cachedData && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION_MS) {
            updateNewsUI(JSON.parse(cachedData).slice(0, 5));
            return;
        }

        // Usamos rss2json para convertir el RSS de Google News a formato JSON fácilmente procesable
        const rssUrl = encodeURIComponent('https://news.google.com/rss/search?q=Mundial+2026+futbol&hl=es&gl=ES&ceid=ES:es');
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Error en rss2json');
        
        const data = await response.json();
        if (data.status === 'ok' && data.items && data.items.length > 0) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data.items));
            localStorage.setItem(CACHE_TIME_KEY, now.toString());
            updateNewsUI(data.items.slice(0, 5)); // Mostrar las 5 últimas noticias
        } else {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size: 0.9rem;">No se encontraron noticias recientes.</p>';
        }
    } catch (error) {
        console.error("Error cargando noticias:", error);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size: 0.9rem;">No se pudieron cargar las noticias en este momento.</p>';
    }
}

function updateNewsUI(articles) {
    const container = document.getElementById('news-container');
    if (!container) return;

    let html = '';
    articles.forEach(article => {
        // Formatear la fecha (ej. "hace 2 horas" o la fecha corta)
        const dateObj = new Date(article.pubDate);
        const dateStr = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
        
        html += `
            <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="news-item">
                <span class="news-title">${article.title}</span>
                <span class="news-date">📅 ${dateStr}</span>
            </a>
        `;
    });

    container.innerHTML = html;
}
