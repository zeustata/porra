// api-engine.js
// Motor para calcular los puntos basados en los pronósticos y los resultados reales

// REGÍSTRATE GRATIS en https://www.football-data.org/client/register para obtener tu token en 10 segundos
const API_KEY = "eb33115c8c4843729c576baff6e57958";

// La lista de participantes se cierra el 5 de junio
let allParticipants = [];
let globalAllMatches = [];
let globalOfficialAnswers = [];
let globalRealResults = {
    matches: [],
    groupStandings: {},
    knockouts: [],
    finalAwards: { champion: null, thirdPlace: null }
};
let globalClassifiedTlasList = [];

// Función principal que inicializa el motor
async function initEngine() {
    try {
        // Obtener la versión dinámica de la caché desde el script actual para no tener que cambiarlo a mano
        const scriptTag = document.querySelector('script[src*="api-engine.js"]');
        const cacheVer = scriptTag && scriptTag.src.includes('?v=') ? scriptTag.src.split('?v=')[1] : Date.now();

        // 1. Cargar pronósticos de los participantes
        const responsePart = await fetch(`data/participants.json?v=${cacheVer}`);
        if (!responsePart.ok) throw new Error('No se pudo cargar participants.json');
        const participants = await responsePart.json();
        allParticipants = participants;
        populateParticipantSelect(participants);
        
        // 1.5 Cargar Respuestas Oficiales
        let officialAnswers = [];
        try {
            const responseOff = await fetch(`data/official_answers.json?v=${cacheVer}`);
            if (responseOff.ok) {
                officialAnswers = await responseOff.json();
            }
        } catch(e) {
            console.warn("No se pudo cargar official_answers.json");
        }

        // 1.8 Cargar Live Overrides (sin caché, forzando la última versión)
        let liveOverrides = {};
        try {
            const responseOverride = await fetch(`data/live_scores.json?t=${Date.now()}`);
            if (responseOverride.ok) {
                liveOverrides = await responseOverride.json();
            }
        } catch(e) {
            console.warn("No se pudo cargar live_scores.json");
        }

        // 2. Conectar a la API real con sistema de caché en localStorage (30 minutos)
        let realResults = {
            matches: [],
            groupStandings: {},
            knockouts: [],
            finalAwards: { champion: null, thirdPlace: null }
        };
        
        let data = null;
        
        try {
            const CACHE_KEY = "wc_matches_cache_v6";
            const CACHE_TIME_KEY = "wc_matches_cache_time_v6";
            const CACHE_DURATION_MS = 300000; // 5 minutos
            
            const now = Date.now();
            const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
            const cachedData = localStorage.getItem(CACHE_KEY);
            
            if (cachedData && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION_MS) {
                // Usar caché válida
                data = JSON.parse(cachedData);
            } else {
                // Si hay un token configurado, llamamos a la API
                if (API_KEY && API_KEY !== "TU_TOKEN_DE_FOOTBALL_DATA_ORG" && API_KEY.trim() !== "") {
                    const apiUrl = `https://api.football-data.org/v4/competitions/WC/matches`;
                    const responseApi = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            "X-Auth-Token": API_KEY
                        }
                    });
                    if (responseApi.ok) {
                        data = await responseApi.json();
                        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
                        localStorage.setItem(CACHE_TIME_KEY, now.toString());
                    } else {
                        console.warn("La API de Football-Data devolvió un error de red o de cuota.");
                    }
                }
            }
            
            // Si la API falló o no hay token, pero tenemos caché vieja, la cargamos
            if (!data && cachedData) {
                data = JSON.parse(cachedData);
            }
        } catch (apiError) {
            console.error("Error conectando a la API de Football-Data:", apiError);
        }
        
        // Fallback de contingencia a la caché o datos simulados si la carga falló
        if (!data) {
            const cachedData = localStorage.getItem("wc_matches_cache_v6");
            if (cachedData) {
                try {
                    data = JSON.parse(cachedData);
                } catch (e) {
                    console.error("Caché corrupta:", e);
                }
            }
        }
        if (!data) {
            data = getMockData();
        }

        // Realizar mapeo y setup de resultados reales
        if (data && data.matches && data.matches.length > 0) {
            // --- LIVE OVERRIDES ---
            data.matches.forEach(m => {
                if (m.homeTeam && m.homeTeam.name && liveOverrides[m.homeTeam.name]) {
                    m.status = liveOverrides[m.homeTeam.name].status || "IN_PLAY";
                    if (!m.score) m.score = {};
                    if (!m.score.fullTime) m.score.fullTime = {};
                    m.score.fullTime.home = liveOverrides[m.homeTeam.name].home;
                    m.score.fullTime.away = liveOverrides[m.homeTeam.name].away;
                }
            });
            // ----------------------
            const allMatches = data.matches;
            globalAllMatches = allMatches; // Guardar globalmente para búsquedas
            
            // Mapear partidos de fase de grupos terminados o en juego
            realResults.matches = allMatches.filter(m => m.stage === "GROUP_STAGE").map(m => ({
                matchId: m.id,
                homeTeam: m.homeTeam.name,
                awayTeam: m.awayTeam.name,
                homeGoals: (m.score && m.score.fullTime && m.score.fullTime.home !== null) ? m.score.fullTime.home : 0,
                awayGoals: (m.score && m.score.fullTime && m.score.fullTime.away !== null) ? m.score.fullTime.away : 0,
                status: m.status === "FINISHED" ? "FINISHED" : ((["IN_PLAY", "PAUSED"].includes(m.status) || (["TIMED", "SCHEDULED"].includes(m.status) && (new Date(m.utcDate).getTime() <= Date.now() || m.homeTeam.name === "Mexico" || m.homeTeam.name === "México"))) ? "LIVE" : "SCHEDULED")
            }));
            
            // Calcular clasificaciones de grupos
            realResults.groupStandings = calculateGroupStandings(allMatches);
            
            // Extraer eliminatorias
            realResults.knockouts = extractKnockouts(allMatches);
            
            // Extraer campeón/3er puesto
            realResults.finalAwards = extractAwards(allMatches);
        }

        // 3. Calcular puntos y pintar en pantalla
        globalRealResults = realResults;
        globalOfficialAnswers = officialAnswers;
        const result = calculateScores(participants, realResults, officialAnswers);
        updateGruposLeaderboardUI(result.groups);
        updatePreguntasLeaderboardUI(result.questions);
        
        // Obtener el próximo partido
        let nextMatch = null;
        if (data && data.matches) {
            nextMatch = getNextMatch(data.matches);
        }
        
        // Filtrar partidos de la jornada para mostrarlos (en juego, finalizados u otros programados hoy)
        const today = new Date();
        const matchesToday = (data && data.matches) ? data.matches.filter(m => {
            if (["IN_PLAY", "PAUSED"].includes(m.status) || (["TIMED", "SCHEDULED"].includes(m.status) && (new Date(m.utcDate).getTime() <= Date.now() || m.homeTeam.name === "Mexico" || m.homeTeam.name === "México"))) return true;
            if (isSameDay(new Date(m.utcDate), today)) return true;
            return false;
        }).map(m => ({
            id: m.id,
            homeTeam: m.homeTeam.name,
            awayTeam: m.awayTeam.name,
            homeGoals: (m.score && m.score.fullTime && m.score.fullTime.home !== null) ? m.score.fullTime.home : 0,
            awayGoals: (m.score && m.score.fullTime && m.score.fullTime.away !== null) ? m.score.fullTime.away : 0,
            status: m.status === "FINISHED" ? "FINISHED" : ((["IN_PLAY", "PAUSED"].includes(m.status) || (["TIMED", "SCHEDULED"].includes(m.status) && (new Date(m.utcDate).getTime() <= Date.now() || m.homeTeam.name === "Mexico" || m.homeTeam.name === "México"))) ? "LIVE" : "SCHEDULED"),
            date: new Date(m.utcDate)
        })) : [];

        updateMatchesUI(matchesToday, nextMatch);
        
        // 4. Cargar últimas noticias
        fetchNews();

    } catch (error) {
        console.error("Error inicializando el motor:", error);
    }
}

// --- FUNCIONES AUXILIARES PARA EL PARSEO DE FOOTBALL-DATA.ORG ---

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function getNextMatch(allMatches) {
    const now = Date.now();
    const futureMatches = allMatches.filter(m => ["SCHEDULED", "TIMED"].includes(m.status) && new Date(m.utcDate).getTime() > now && m.homeTeam.name !== "Mexico" && m.homeTeam.name !== "México");
    
    if (futureMatches.length > 0) {
        futureMatches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
        const next = futureMatches[0];
        return {
            id: next.id,
            homeTeam: next.homeTeam.name || "Por Definir",
            awayTeam: next.awayTeam.name || "Por Definir",
            date: new Date(next.utcDate)
        };
    }
    
    // Fallback simulado si no hay partidos futuros cargados (solo válido durante la inauguración)
    const fallbackDate = new Date("2026-06-11T19:00:00Z");
    if (Date.now() < fallbackDate.getTime() + (3 * 60 * 60 * 1000)) { // Expira a las 22:00 UTC (00:00 España)
        return {
            id: 1,
            homeTeam: "México",
            awayTeam: "Sudáfrica",
            date: fallbackDate
        };
    }
    return null;
}

function calculateGroupStandings(matches) {
    const standings = {};
    const finishedCount = {};
    
    // 1. Inicializar los equipos de cada grupo
    matches.forEach(m => {
        if (m.stage === "GROUP_STAGE" && m.group) {
            const groupLetter = m.group.replace("Group ", "").replace("GROUP_", "").trim();
            if (!standings[groupLetter]) {
                standings[groupLetter] = {};
                finishedCount[groupLetter] = 0;
            }
            if (m.homeTeam && m.homeTeam.tla) {
                if (!standings[groupLetter][m.homeTeam.tla]) {
                    standings[groupLetter][m.homeTeam.tla] = { tla: m.homeTeam.tla, pts: 0, gd: 0, gf: 0 };
                }
            }
            if (m.awayTeam && m.awayTeam.tla) {
                if (!standings[groupLetter][m.awayTeam.tla]) {
                    standings[groupLetter][m.awayTeam.tla] = { tla: m.awayTeam.tla, pts: 0, gd: 0, gf: 0 };
                }
            }
        }
    });

    // 2. Acumular estadísticas de partidos finalizados
    matches.forEach(m => {
        if (m.stage === "GROUP_STAGE" && m.status === "FINISHED" && m.group) {
            const groupLetter = m.group.replace("Group ", "").replace("GROUP_", "").trim();
            const homeTla = m.homeTeam.tla;
            const awayTla = m.awayTeam.tla;
            
            const homeGoals = (m.score && m.score.fullTime) ? m.score.fullTime.home : null;
            const awayGoals = (m.score && m.score.fullTime) ? m.score.fullTime.away : null;
            
            if (homeGoals !== null && awayGoals !== null && standings[groupLetter][homeTla] && standings[groupLetter][awayTla]) {
                finishedCount[groupLetter]++;
                const home = standings[groupLetter][homeTla];
                const away = standings[groupLetter][awayTla];
                
                home.gf += homeGoals;
                home.gd += (homeGoals - awayGoals);
                away.gf += awayGoals;
                away.gd += (awayGoals - homeGoals);
                
                if (homeGoals > awayGoals) {
                    home.pts += 3;
                } else if (homeGoals < awayGoals) {
                    away.pts += 3;
                } else {
                    home.pts += 1;
                    away.pts += 1;
                }
            }
        }
    });

    // 3. Ordenar cada grupo por criterios FIFA estándar
    const sortedStandings = {};
    Object.keys(standings).forEach(groupLetter => {
        // Solo calculamos clasificación real si se ha jugado al menos un partido en el grupo
        if (!finishedCount[groupLetter] || finishedCount[groupLetter] === 0) {
            return;
        }
        const teams = Object.values(standings[groupLetter]);
        teams.sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });
        sortedStandings[groupLetter] = teams;
    });

    return sortedStandings;
}

function extractKnockouts(matches) {
    const knockouts = [];
    const stageMapping = {
        "LAST_16": "Octavos",
        "QUARTER_FINALS": "Cuartos",
        "SEMI_FINALS": "Semifinales",
        "THIRD_PLACE": "TercerPuesto",
        "FINAL": "Final"
    };

    matches.forEach(m => {
        if (m.stage && stageMapping[m.stage]) {
            // Goles en los primeros 90 minutos: usamos regularTime si existe, si no fullTime
            let homeGoals = null;
            let awayGoals = null;
            
            if (m.score) {
                if (m.score.regularTime && m.score.regularTime.home !== null) {
                    homeGoals = m.score.regularTime.home;
                    awayGoals = m.score.regularTime.away;
                } else if (m.score.fullTime && m.score.fullTime.home !== null) {
                    homeGoals = m.score.fullTime.home;
                    awayGoals = m.score.fullTime.away;
                }
            }

            knockouts.push({
                matchId: m.id,
                round: stageMapping[m.stage],
                homeTeam: m.homeTeam ? (m.homeTeam.tla || m.homeTeam.name) : null,
                awayTeam: m.awayTeam ? (m.awayTeam.tla || m.awayTeam.name) : null,
                homeGoals: homeGoals,
                awayGoals: awayGoals,
                status: m.status === "FINISHED" ? "FINISHED" : ((["IN_PLAY", "PAUSED"].includes(m.status) || (["TIMED", "SCHEDULED"].includes(m.status) && (new Date(m.utcDate).getTime() <= Date.now() || (m.homeTeam && (m.homeTeam.name === "Mexico" || m.homeTeam.name === "México"))))) ? "LIVE" : "SCHEDULED")
            });
        }
    });

    return knockouts;
}

function extractAwards(matches) {
    let champion = null;
    let thirdPlace = null;

    matches.forEach(m => {
        if (m.status === "FINISHED") {
            if (m.stage === "FINAL") {
                const winnerTeam = m.score.winner === "HOME_TEAM" ? m.homeTeam : (m.score.winner === "AWAY_TEAM" ? m.awayTeam : null);
                if (winnerTeam) {
                    champion = winnerTeam.tla || winnerTeam.name;
                }
            } else if (m.stage === "THIRD_PLACE") {
                const winnerTeam = m.score.winner === "HOME_TEAM" ? m.homeTeam : (m.score.winner === "AWAY_TEAM" ? m.awayTeam : null);
                if (winnerTeam) {
                    thirdPlace = winnerTeam.tla || winnerTeam.name;
                }
            }
        }
    });

    return { champion, thirdPlace };
}

function getMockData() {
    return {
        matches: [
            // Partido inaugural simulado para la cuenta atrás
            {
                id: 1,
                status: "SCHEDULED",
                utcDate: "2026-06-11T19:00:00Z", // Inauguración Mundial 2026
                stage: "GROUP_STAGE",
                group: "Group A",
                homeTeam: { name: "México", tla: "MEX" },
                awayTeam: { name: "Sudáfrica", tla: "RSA" },
                score: {
                    winner: null,
                    fullTime: { home: null, away: null },
                    regularTime: { home: null, away: null }
                }
            }
        ]
    };
}

// Lógica matemática para calcular los puntos
function calculateScores(participants, realResults, officialAnswers = []) {
    let groupsLeaderboard = [];
    let questionsLeaderboard = [];

    // --- 0. PRE-CALCULAR CLASIFICADOS DE FASE DE GRUPOS ---
    let globalClassifiedTlas = [];
    if (realResults.groupStandings && Object.keys(realResults.groupStandings).length > 0) {
        let allThirds = [];
        Object.keys(realResults.groupStandings).forEach(groupId => {
            const groupTeams = realResults.groupStandings[groupId];
            if (groupTeams.length > 0) {
                globalClassifiedTlas.push(groupTeams[0].tla); // 1º
                if (groupTeams.length > 1) globalClassifiedTlas.push(groupTeams[1].tla); // 2º
                if (groupTeams.length > 2) allThirds.push(groupTeams[2]); // 3º
            }
        });
        // Ordenar los terceros (FIFA: pts > gd > gf)
        allThirds.sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });
        // Sumar los 8 mejores terceros a la lista global
        const best8Thirds = allThirds.slice(0, 8);
        best8Thirds.forEach(t => globalClassifiedTlas.push(t.tla));
    }
    globalClassifiedTlasList = globalClassifiedTlas;

    participants.forEach(p => {
        // --- 1. CLASIFICACIÓN PREGUNTAS ESPECIALES ---
        let specialPts = 0;
        
        if (p.predictions.specialQuestionsAnswers && officialAnswers.length > 0) {
            p.predictions.specialQuestionsAnswers.forEach(pAnswer => {
                const off = officialAnswers.find(o => o.question === pAnswer.question);
                if (off && off.answer !== null && off.answer !== "") {
                    // Normalizar respuestas a minúsculas para evitar fallos tontos (ej: "México" vs "méxico")
                    const ans1 = pAnswer.answer.toString().trim().toLowerCase();
                    const ans2 = off.answer.toString().trim().toLowerCase();
                    if (ans1 === ans2) {
                        specialPts += off.points;
                    }
                }
            });
        }
        
        // Sumar también los puntos manuales por si acaso, y guardar para la UI
        specialPts += (p.predictions.specialPoints || 0);
        p.calculatedSpecialPoints = specialPts;
        
        questionsLeaderboard.push({
            name: p.name,
            points: specialPts,
            basePoints: specialPts,
            livePoints: 0
        });

        // --- 2. CLASIFICACIÓN FASE DE GRUPOS ---
        let basePoints = (p.predictions.groupStagePoints || 0);
        let livePoints = 0;

        // Partidos de Fase de Grupos
        if (p.predictions.matches) {
            p.predictions.matches.forEach(pred => {
                const real = realResults.matches ? realResults.matches.find(r => r.matchId === pred.matchId) : null;
                // ¡AQUÍ ESTÁ LA MAGIA!: Calculamos puntos tanto si el partido ha terminado (basePoints) como si está en juego (livePoints)
                if (real && (real.status === "FINISHED" || real.status === "LIVE")) {
                    let pts = 0;
                    // Signo (1X2) provisional o final -> 2 Puntos
                    let realSign = "X";
                    if (real.homeGoals > real.awayGoals) realSign = "1";
                    else if (real.homeGoals < real.awayGoals) realSign = "2";

                    let predSign = "X";
                    if (pred.sign) {
                        predSign = pred.sign;
                    } else {
                        if (pred.homeGoals > pred.awayGoals) predSign = "1";
                        else if (pred.homeGoals < pred.awayGoals) predSign = "2";
                    }

                    if (predSign === realSign) {
                        pts += 2;
                    }

                    // Goles exactos provisionales o finales -> 1 Punto por equipo
                    if (pred.homeGoals === real.homeGoals) pts += 1;
                    if (pred.awayGoals === real.awayGoals) pts += 1;
                    
                    if (real.status === "LIVE") {
                        livePoints += pts;
                    } else {
                        basePoints += pts;
                    }
                }
            });
        }

        let groupPoints = 0;

        // Clasificación de Grupos (Standings)
        if (p.predictions.groupStandings && realResults.groupStandings) {
            Object.keys(p.predictions.groupStandings).forEach(groupId => {
                const predGroup = p.predictions.groupStandings[groupId]; // ej: ["ESP", "GER", "JPN", "CRC"]
                const realGroup = realResults.groupStandings[groupId];
                if (!realGroup || realGroup.length === 0) return; 
                
                // Se apuesta que clasifican los que pones 1º, 2º y 3º
                const predClassified = predGroup.slice(0, 3);

                predClassified.forEach(team => {
                    if (globalClassifiedTlas.includes(team)) {
                        groupPoints += 5; // Acertó que el equipo se clasifica
                    }
                });

                predGroup.forEach((team, index) => {
                    if (realGroup[index] && realGroup[index].tla === team) {
                        groupPoints += 3; // Acertó la posición exacta en el grupo
                    }
                });
            });
        }

        let totalGroupPoints = basePoints + livePoints + groupPoints;
        groupsLeaderboard.push({
            name: p.name,
            points: totalGroupPoints,
            basePoints: basePoints,
            livePoints: livePoints,
            groupPoints: groupPoints
        });
    });

    // Ordenar de mayor a menor
    groupsLeaderboard.sort((a, b) => b.points - a.points);
    questionsLeaderboard.sort((a, b) => b.points - a.points);
    
    return {
        groups: groupsLeaderboard,
        questions: questionsLeaderboard
    };
}

function getPointsForRound(roundName) {
    switch(roundName) {
        case 'Octavos': return 5;
        case 'Cuartos': return 10;
        case 'Semifinales': return 15;
        case 'TercerPuesto': return 25;
        case 'Final': return 30;
        default: return 0;
    }
}

// Variables globales para el estado de la tabla
let showFullGrupos = false;
let lastGruposLeaderboard = [];
let showFullPreguntas = false;
let lastPreguntasLeaderboard = [];

window.toggleGruposLeaderboard = function() {
    showFullGrupos = !showFullGrupos;
    updateGruposLeaderboardUI(lastGruposLeaderboard);
};

window.togglePreguntasLeaderboard = function() {
    showFullPreguntas = !showFullPreguntas;
    updatePreguntasLeaderboardUI(lastPreguntasLeaderboard);
};

// Función auxiliar genérica para renderizar una lista de clasificación
function renderLeaderboardList(elementId, btnId, leaderboard, showFull, isQuestions = false) {
    const list = document.getElementById(elementId);
    const btnVerCompleta = document.getElementById(btnId);
    if (!list) return;

    list.innerHTML = '';
    
    if (leaderboard.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Aún no hay participantes (cierre el 5 de junio).</p>';
        if (btnVerCompleta) btnVerCompleta.style.display = 'none';
        return;
    }
    
    let itemsToShow = showFull ? leaderboard : leaderboard.slice(0, 5);
    
    if (leaderboard.length > 5) {
        if (btnVerCompleta) {
            btnVerCompleta.style.display = 'block';
            btnVerCompleta.innerText = showFull ? 'Ver Menos' : 'Ver Completa';
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

        let pointsHtml = ``;
        let nameStyle = '';
        
        if (!isQuestions) {
            pointsHtml = `<div style="text-align: right;">`;
            pointsHtml += `<div style="font-weight: bold; color: var(--text-light); font-size: 1.1rem;">${p.points} pts</div>`;
            pointsHtml += `<div style="font-size: 0.75rem; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 2px;">`;
            
            // Puntos de base (partidos finalizados)
            pointsHtml += `<span style="color:var(--text-muted)" title="Puntos definitivos de partidos finalizados">${p.basePoints} base</span>`;
            
            // Puntos live (rojo)
            if (p.livePoints > 0) {
                pointsHtml += `<span style="color:var(--neon-gold); animation: pulse 1.5s infinite;" title="Puntos provisionales de partidos en juego">+${p.livePoints} live 🔴</span>`;
            }
            
            // Puntos provisionales de grupos (morado)
            if (p.groupPoints > 0) {
                pointsHtml += `<span style="color:var(--neon-magenta);" title="Puntos provisionales por clasificación de grupo">+${p.groupPoints} prov 📊</span>`;
            }
            
            pointsHtml += `</div></div>`;
            
            if (p.livePoints > 0) {
                nameStyle = 'color: var(--neon-gold); font-weight: 600; text-shadow: 0 0 8px rgba(255,207,0,0.2);';
            }
        } else {
            pointsHtml = `<strong style="color:var(--neon-cyan)">${p.points} pts</strong>`;
        }

        item.innerHTML = `<span style="${nameStyle}; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:10px;">${medal}${p.name}</span> <div>${pointsHtml}</div>`;
        list.appendChild(item);
    });
}

function updateGruposLeaderboardUI(leaderboard) {
    lastGruposLeaderboard = leaderboard;
    renderLeaderboardList('leaderboard-grupos', 'btn-ver-completa-grupos', leaderboard, showFullGrupos, false);
}

function updatePreguntasLeaderboardUI(leaderboard) {
    lastPreguntasLeaderboard = leaderboard;
    renderLeaderboardList('leaderboard-preguntas', 'btn-ver-completa-preguntas', leaderboard, showFullPreguntas, true);
}

function updateMatchesUI(matches, nextMatch = null) {
    const container = document.getElementById('matches-container');
    if (!container) return;

    // Limpiar intervalo anterior para que no haya relojes fantasma
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    container.innerHTML = '';
    
    // Asegurar que el contenedor tenga scroll si hay muchos partidos
    container.style.maxHeight = '400px';
    container.style.overflowY = 'auto';
    container.style.paddingRight = '5px';
    container.classList.add('custom-scrollbar'); 

    const liveMatches = matches.filter(m => m.status === "LIVE");
    const finishedMatches = matches.filter(m => m.status === "FINISHED");
    const scheduledMatches = matches.filter(m => m.status === "SCHEDULED" && (!nextMatch || m.id !== nextMatch.id));

    // Función auxiliar para crear la fila de un partido
    const createMatchRow = (m) => {
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
            const cachedTimeMs = localStorage.getItem("wc_matches_cache_time_v6");
            const updateTime = cachedTimeMs ? new Date(parseInt(cachedTimeMs)) : new Date();
            const timeStrStr = updateTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            middleContent = `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span style="background:var(--neon-gold); padding:3px 12px; border-radius:12px; font-weight:bold; color:black; font-size:1rem; animation: pulse 1.5s infinite;">${m.homeGoals} - ${m.awayGoals}</span>
                <span style="font-size:0.6rem; color:var(--neon-gold); font-weight:800; text-transform:uppercase; letter-spacing:1px;">EN DIRECTO</span>
                <span style="font-size:0.55rem; color:var(--text-muted); font-weight:normal; text-transform:none; margin-top:-2px;">Act: ${timeStrStr}</span>
            </div>`;
        } else if (m.status === "FINISHED") {
            middleContent = `<span style="background:var(--neon-magenta); padding:5px 15px; border-radius:15px; font-weight:bold;">${m.homeGoals} - ${m.awayGoals}</span>`;
        } else {
            const timeStr = m.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            middleContent = `<span style="color:var(--neon-cyan); font-weight:bold;">${timeStr}</span>`;
        }

        matchDiv.innerHTML = `
            <span style="flex:1; text-align:right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; padding-right: 8px;" title="${m.homeTeam}">${m.homeTeam}</span>
            <div style="display:flex; justify-content:center; min-width: 80px;">${middleContent}</div>
            <span style="flex:1; text-align:left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; padding-left: 8px;" title="${m.awayTeam}">${m.awayTeam}</span>
        `;
        return matchDiv;
    };

    // 1. Renderizar Partidos EN JUEGO (Arriba del todo)
    if (liveMatches.length > 0) {
        liveMatches.forEach(m => container.appendChild(createMatchRow(m)));
    }
    
    // 2. Renderizar PRÓXIMO PARTIDO (Cuenta atrás en el medio)
    if (nextMatch) {
        if (liveMatches.length > 0) {
            const separator = document.createElement('div');
            separator.style.borderTop = '1px dashed rgba(255,255,255,0.2)';
            separator.style.margin = '15px 0';
            container.appendChild(separator);
        }

        const matchDiv = document.createElement('div');
        matchDiv.style.background = 'rgba(0,0,0,0.3)';
        matchDiv.style.padding = '15px';
        matchDiv.style.borderRadius = '8px';
        matchDiv.style.textAlign = 'center';
        matchDiv.style.marginBottom = '10px';
        
        const localTimeStr = nextMatch.date.toLocaleString('es-ES', { 
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
        });

        matchDiv.innerHTML = `
            <p style="color:var(--text-muted); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Siguiente Partido (${localTimeStr})</p>
            <div style="display:flex; justify-content:center; align-items:center; gap: 15px; margin-bottom: 12px; font-weight: bold; font-size: 1.2rem; width: 100%;">
                <span style="flex:1; text-align:right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;" title="${nextMatch.homeTeam}">${nextMatch.homeTeam}</span>
                <span style="color:var(--neon-magenta); font-size: 0.9rem; min-width: 30px;">VS</span>
                <span style="flex:1; text-align:left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;" title="${nextMatch.awayTeam}">${nextMatch.awayTeam}</span>
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

            if (distance < 0 || nextMatch.homeTeam === "México" || nextMatch.homeTeam === "Mexico") {
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

    }
    
    // 3. Renderizar OTROS PARTIDOS PROGRAMADOS PARA HOY
    if (scheduledMatches.length > 0) {
        if (liveMatches.length > 0 || nextMatch) {
            const separator = document.createElement('div');
            separator.style.borderTop = '1px dashed rgba(255,255,255,0.2)';
            separator.style.margin = '15px 0';
            container.appendChild(separator);
        }
        scheduledMatches.forEach(m => container.appendChild(createMatchRow(m)));
    }

    // 4. Renderizar Partidos FINALIZADOS (Abajo del todo)
    if (finishedMatches.length > 0) {
        if (liveMatches.length > 0 || nextMatch || scheduledMatches.length > 0) {
            const separator = document.createElement('div');
            separator.style.borderTop = '1px dashed rgba(255,255,255,0.2)';
            separator.style.margin = '15px 0';
            container.appendChild(separator);
        }
        finishedMatches.forEach(m => container.appendChild(createMatchRow(m)));
    }

    if (matches.length === 0 && !nextMatch) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No hay partidos a la vista o buscando conexión...</p>';
    }
}

// Iniciar al cargar la página y configurar actualización automática (polling)
window.addEventListener('DOMContentLoaded', () => {
    initEngine(); // Primera carga inmediata
    
    // Configurar actualización en tiempo real cada 5 minutos (300000 ms) para proteger cuota de API
    setInterval(initEngine, 300000);
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
    if (!p || !p.predictions) {
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

    // Render Tab Buttons and Tab Content Areas
    container.innerHTML = `
        <div class="predictions-tabs" style="display: flex; gap: 6px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <button class="pred-tab-btn active" onclick="switchPredictionsTab(this, 'matches')" style="flex: 1; background: rgba(0, 242, 254, 0.15); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); padding: 8px 4px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; outline: none; font-family: inherit;">⚽ Partidos</button>
            <button class="pred-tab-btn" onclick="switchPredictionsTab(this, 'groups')" style="flex: 1; background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: 8px 4px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; outline: none; font-family: inherit;">📊 Grupos</button>
            <button class="pred-tab-btn" onclick="switchPredictionsTab(this, 'questions')" style="flex: 1; background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: 8px 4px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; outline: none; font-family: inherit;">🧠 Preguntas</button>
        </div>
        <div id="pred-tab-content-matches" class="pred-tab-content-pane" style="display: block; max-height: 400px; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
            <!-- Matches list -->
        </div>
        <div id="pred-tab-content-groups" class="pred-tab-content-pane" style="display: none; max-height: 400px; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
            <!-- Groups -->
        </div>
        <div id="pred-tab-content-questions" class="pred-tab-content-pane" style="display: none; max-height: 400px; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
            <!-- Special questions -->
        </div>
        <style>
            .pred-tab-content-pane::-webkit-scrollbar { width: 4px; }
            .pred-tab-content-pane::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
            .pred-tab-content-pane::-webkit-scrollbar-thumb { background: rgba(0,242,254,0.2); border-radius: 4px; }
        </style>
    `;

    // 1. Matches and Quiniela Tab Content
    const matchesPane = document.getElementById('pred-tab-content-matches');
    if (p.predictions.matches && p.predictions.matches.length > 0) {
        let matchesHtml = '';
        p.predictions.matches.forEach(m => {
            let homeName = m.homeTeam;
            let awayName = m.awayTeam;
            
            if (!homeName || !awayName) {
                const realMatch = globalAllMatches.find(r => r.id === m.matchId);
                if (realMatch) {
                    homeName = realMatch.homeTeam.name;
                    awayName = realMatch.awayTeam.name;
                } else {
                    homeName = `Partido ${m.matchId}`;
                    awayName = "";
                }
            }

            const realMatch = globalAllMatches.find(r => r.id === m.matchId);
            let realResultHtml = '';
            if (realMatch && (realMatch.status === "FINISHED" || realMatch.status === "LIVE" || ["IN_PLAY", "PAUSED"].includes(realMatch.status))) {
                const homeGoalsReal = (realMatch.score && realMatch.score.fullTime && realMatch.score.fullTime.home !== null) ? realMatch.score.fullTime.home : 0;
                const awayGoalsReal = (realMatch.score && realMatch.score.fullTime && realMatch.score.fullTime.away !== null) ? realMatch.score.fullTime.away : 0;
                const statusLabel = realMatch.status === "FINISHED" ? "Final" : "En Juego 🔴";
                const statusColor = realMatch.status === "FINISHED" ? "var(--text-muted)" : "var(--neon-gold)";
                
                // Calcular puntos
                let matchPts = 0;
                let realSign = "X";
                if (homeGoalsReal > awayGoalsReal) realSign = "1";
                else if (homeGoalsReal < awayGoalsReal) realSign = "2";
                
                if (m.sign === realSign) matchPts += 2;
                if (m.homeGoals === homeGoalsReal) matchPts += 1;
                if (m.awayGoals === awayGoalsReal) matchPts += 1;
                
                realResultHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.07); font-size: 0.75rem;">
                        <span style="color: ${statusColor}; font-weight: 500;">Real: ${homeGoalsReal} - ${awayGoalsReal} (${statusLabel})</span>
                        <span style="color: var(--neon-gold); font-weight: bold;">+${matchPts} pts</span>
                    </div>
                `;
            }

            matchesHtml += `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 0.85rem; flex: 1; text-align: right; padding-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${homeName}</span>
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 70px;">
                            <span style="color: var(--neon-cyan); font-weight: 800; font-size: 0.95rem;">
                                ${m.homeGoals} - ${m.awayGoals}
                            </span>
                            <span style="background: rgba(0,242,254,0.1); border: 1px solid rgba(0,242,254,0.3); color: var(--neon-cyan); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">
                                Signo: ${m.sign}
                            </span>
                        </div>
                        <span style="font-weight: 600; font-size: 0.85rem; flex: 1; text-align: left; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${awayName}</span>
                    </div>
                    ${realResultHtml}
                </div>
            `;
        });
        matchesPane.innerHTML = matchesHtml;
    } else {
        matchesPane.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px 0; font-size: 0.85rem;">No hay pronósticos de partidos.</p>';
    }

    // 2. Groups Tab Content
    const groupsPane = document.getElementById('pred-tab-content-groups');
    if (p.predictions.groupStandings) {
        let groupsHtml = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 2px;">';
        
        Object.keys(p.predictions.groupStandings).forEach(groupId => {
            const predGroup = p.predictions.groupStandings[groupId];
            const realGroup = globalRealResults.groupStandings ? globalRealResults.groupStandings[groupId] : null;
            
            groupsHtml += `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; display: flex; flex-direction: column;">
                    <h4 style="color: var(--neon-cyan); border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; margin-bottom: 6px; font-size: 0.8rem; text-align: center; font-weight: bold;">Grupo ${groupId}</h4>
                    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem;">
            `;
            
            predGroup.forEach((team, idx) => {
                let statusIcon = '';
                let teamColor = 'var(--text-light)';
                
                if (realGroup && realGroup.length > 0) {
                    const isClassifiedReal = globalClassifiedTlasList.includes(team);
                    const isClassifiedPred = idx < 3;
                    const exactPos = realGroup[idx] && realGroup[idx].tla === team;
                    
                    let ptSum = 0;
                    if (isClassifiedPred && isClassifiedReal) ptSum += 5;
                    if (exactPos) ptSum += 3;
                    
                    if (ptSum > 0) {
                        teamColor = 'var(--neon-gold)';
                        statusIcon = ` <span style="color: var(--neon-gold); font-size: 0.7rem;">✔ (+${ptSum})</span>`;
                    } else {
                        statusIcon = ` <span style="color: rgba(255,255,255,0.3); font-size: 0.7rem;">(0)</span>`;
                    }
                }
                
                groupsHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: ${teamColor};">
                        <span>${idx + 1}. ${team}</span>
                        <span>${statusIcon}</span>
                    </div>
                `;
            });
            
            groupsHtml += `
                    </div>
                </div>
            `;
        });
        groupsHtml += '</div>';
        groupsPane.innerHTML = groupsHtml;
    } else {
        groupsPane.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px 0; font-size: 0.85rem;">No hay pronósticos de clasificaciones de grupos.</p>';
    }

    // 3. Questions Tab Content
    const questionsPane = document.getElementById('pred-tab-content-questions');
    if (p.predictions.specialQuestionsAnswers && p.predictions.specialQuestionsAnswers.length > 0) {
        let questionsHtml = '';
        p.predictions.specialQuestionsAnswers.forEach(qAns => {
            const off = globalOfficialAnswers.find(o => o.question === qAns.question);
            let statusHtml = '';
            let rowStyle = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);';
            
            if (off && off.answer !== null && off.answer !== "") {
                const ans1 = qAns.answer.toString().trim().toLowerCase();
                const ans2 = off.answer.toString().trim().toLowerCase();
                if (ans1 === ans2) {
                    statusHtml = `<span style="color: var(--neon-gold); font-weight: bold; font-size: 0.75rem;">✔ +${off.points} pts</span>`;
                    rowStyle = 'background: rgba(255, 207, 0, 0.05); border: 1px solid rgba(255, 207, 0, 0.2);';
                } else {
                    statusHtml = `<span style="color: var(--neon-magenta); font-weight: 500; font-size: 0.75rem;">❌ (Oficial: ${off.answer})</span>`;
                    rowStyle = 'background: rgba(255, 0, 127, 0.03); border: 1px solid rgba(255, 0, 127, 0.1);';
                }
            } else {
                statusHtml = `<span style="color: var(--text-muted); font-size: 0.75rem;">⏳ Pendiente (${qAns.points || (off ? off.points : 0)} pts)</span>`;
            }
            
            questionsHtml += `
                <div style="${rowStyle} padding: 8px; border-radius: 8px; margin-bottom: 6px; display: flex; flex-direction: column; gap: 3px; text-align: left;">
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${qAns.question}</span>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 8px;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">Apuesta: <strong style="color: var(--neon-cyan);">${qAns.answer}</strong></span>
                        ${statusHtml}
                    </div>
                </div>
            `;
        });
        
        let specialDisplay = p.calculatedSpecialPoints !== undefined ? p.calculatedSpecialPoints : (p.predictions.specialPoints || 0);
        questionsHtml += `<div style="text-align:center; margin-top:8px; font-size:0.75rem; color:var(--text-muted);">Puntos especiales totales: ${specialDisplay}</div>`;
        
        questionsPane.innerHTML = questionsHtml;
    } else {
        questionsPane.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px 0; font-size: 0.85rem;">No hay pronósticos de preguntas especiales.</p>';
    }
}

// Lógica de pestañas de pronósticos
window.switchPredictionsTab = function(btnElement, tabName) {
    const tabContainer = btnElement.parentNode;
    const buttons = tabContainer.querySelectorAll('.pred-tab-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.borderColor = 'transparent';
        btn.style.color = 'var(--text-muted)';
        btn.style.fontWeight = '600';
    });

    btnElement.classList.add('active');
    btnElement.style.background = 'rgba(0, 242, 254, 0.15)';
    btnElement.style.borderColor = 'var(--neon-cyan)';
    btnElement.style.color = 'var(--neon-cyan)';
    btnElement.style.fontWeight = 'bold';

    const cardBody = tabContainer.parentNode;
    const panes = cardBody.querySelectorAll('.pred-tab-content-pane');
    panes.forEach(pane => {
        pane.style.display = 'none';
    });

    const targetPane = cardBody.querySelector(`#pred-tab-content-${tabName}`);
    if (targetPane) {
        targetPane.style.display = 'block';
    }
};

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

// --- LOGICA DE ADMINISTRADOR ---
window.toggleAdminState = function() {
    const locked = document.getElementById('admin-locked-state');
    const unlocked = document.getElementById('admin-unlocked-state');
    if (unlocked.style.display === 'flex') {
        unlocked.style.display = 'none';
        locked.style.display = 'flex';
        document.getElementById('admin-lock-icon').textContent = '🔒';
    }
};

window.unlockAdmin = function() {
    const pwd = document.getElementById('admin-pwd-input').value;
    const error = document.getElementById('admin-error-msg');
    if (pwd === 'LodeYPrincesa') {
        error.style.display = 'none';
        document.getElementById('admin-locked-state').style.display = 'none';
        document.getElementById('admin-unlocked-state').style.display = 'flex';
        document.getElementById('admin-lock-icon').textContent = '🔓';
        renderAdminQuestions();
    } else {
        error.style.display = 'block';
    }
};

function renderAdminQuestions() {
    const container = document.getElementById('admin-questions-container');
    if (!container) return;
    let html = '';
    if (typeof globalOfficialAnswers !== 'undefined' && globalOfficialAnswers) {
        globalOfficialAnswers.forEach((q, idx) => {
            const val = q.answer || '';
            html += `
                <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 5px;">${q.question} <span style="color:var(--neon-gold)">(${q.points} pts)</span></p>
                    <input type="text" class="admin-q-input" data-idx="${idx}" value="${val}" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--neon-cyan); outline: none;">
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

window.downloadOfficialAnswers = function() {
    const inputs = document.querySelectorAll('.admin-q-input');
    if (!globalOfficialAnswers || globalOfficialAnswers.length === 0) return;
    let newAnswers = JSON.parse(JSON.stringify(globalOfficialAnswers));
    
    inputs.forEach(input => {
        const idx = input.getAttribute('data-idx');
        newAnswers[idx].answer = input.value.trim() === '' ? null : input.value.trim();
    });
    
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(newAnswers, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'official_answers.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    alert('Archivo official_answers.json descargado. ¡Reemplázalo en tu carpeta data/ y súbelo a GitHub!');
};
