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
        
        // 2. Conectar a la API real
        let realResults = [];
        try {
            // En API-Sports, si pasas 'live=all' ignora el filtro de liga y te devuelve todos.
            // Para filtrar directos por liga concreta hay que pasar su ID directo al parámetro 'live'.
            const WORLD_CUP_ID = 1; // ID oficial de la Copa del Mundo
            const apiUrl = `https://v3.football.api-sports.io/fixtures?live=${WORLD_CUP_ID}`;
            
            const responseApi = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    "x-apisports-key": API_KEY
                }
            });
            const data = await responseApi.json();
            
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
                console.log("No hay partidos en directo ahora mismo.");
                realResults = [];
            }
        } catch (apiError) {
            console.error("Error conectando a la API:", apiError);
            realResults = [];
        }

        // 3. Calcular puntos y pintar en pantalla
        const leaderboard = calculateScores(participants, realResults);
        updateLeaderboardUI(leaderboard);
        updateMatchesUI(realResults);
        
        // 4. Cargar últimas noticias
        fetchNews();

    } catch (error) {
        console.error("Error inicializando el motor:", error);
    }
}

// Lógica matemática para calcular los puntos
function calculateScores(participants, realResults) {
    let leaderboard = [];

    participants.forEach(p => {
        let totalPoints = p.predictions.specialPoints || 0;

        p.predictions.matches.forEach(pred => {
            const real = realResults.find(r => r.matchId === pred.matchId);
            if (real && real.status === "FINISHED") {
                // 1. Calcular el signo real (1X2)
                let realSign = "X";
                if (real.homeGoals > real.awayGoals) realSign = "1";
                if (real.homeGoals < real.awayGoals) realSign = "2";

                // Puntos por signo
                if (pred.sign === realSign) {
                    totalPoints += 2;
                }

                // Puntos por goles exactos del equipo local
                if (pred.homeGoals === real.homeGoals) {
                    totalPoints += 1;
                }

                // Puntos por goles exactos del equipo visitante
                if (pred.awayGoals === real.awayGoals) {
                    totalPoints += 1;
                }
            }
        });

        leaderboard.push({ name: p.name, points: totalPoints });
    });

    // Ordenar de mayor a menor
    leaderboard.sort((a, b) => b.points - a.points);
    return leaderboard;
}

// Actualizar el DOM
function updateLeaderboardUI(leaderboard) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    list.innerHTML = '';
    
    if (leaderboard.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Aún no hay participantes (cierre el 5 de junio).</p>';
        return;
    }
    leaderboard.forEach((p, index) => {
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

        item.innerHTML = `<span>${medal}${p.name}</span> <strong style="color:var(--neon-cyan)">${p.points} pts</strong>`;
        list.appendChild(item);
    });
}

function updateMatchesUI(matches) {
    const container = document.getElementById('matches-container');
    if (!container) return;

    container.innerHTML = '';
    
    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Esperando a que empiece el Mundial...</p>';
        return;
    }
    matches.forEach(m => {
        const matchDiv = document.createElement('div');
        matchDiv.style.background = 'rgba(0,0,0,0.3)';
        matchDiv.style.padding = '10px';
        matchDiv.style.borderRadius = '8px';
        matchDiv.style.marginBottom = '10px';
        matchDiv.style.display = 'flex';
        matchDiv.style.justifyContent = 'space-between';
        matchDiv.style.alignItems = 'center';

        matchDiv.innerHTML = `
            <span>${m.homeTeam}</span>
            <span style="background:var(--neon-magenta); padding:5px 15px; border-radius:15px; font-weight:bold;">${m.homeGoals} - ${m.awayGoals}</span>
            <span>${m.awayTeam}</span>
        `;
        container.appendChild(matchDiv);
    });
}

// Iniciar al cargar la página y configurar actualización automática (polling)
window.addEventListener('DOMContentLoaded', () => {
    initEngine(); // Primera carga inmediata
    
    // Configurar actualización en tiempo real cada 60 segundos (60000 ms)
    setInterval(initEngine, 60000);
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
        // Usamos rss2json para convertir el RSS de Google News a formato JSON fácilmente procesable
        const rssUrl = encodeURIComponent('https://news.google.com/rss/search?q=Mundial+2026+futbol&hl=es&gl=ES&ceid=ES:es');
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Error en rss2json');
        
        const data = await response.json();
        if (data.status === 'ok' && data.items && data.items.length > 0) {
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
