// api-engine.js
// Motor para calcular los puntos basados en los pronósticos y los resultados reales

const API_KEY = "7588a7d31cb05d8cebc445333011ae30";

// Datos de fallback por si no hay partidos en directo ahora mismo
const mockRealResults = [
    { matchId: 101, homeTeam: "España", awayTeam: "Croacia", homeGoals: 3, awayGoals: 0, status: "FINISHED" },
    { matchId: 102, homeTeam: "Brasil", awayTeam: "Serbia", homeGoals: 2, awayGoals: 0, status: "FINISHED" }
];

// Función principal que inicializa el motor
async function initEngine() {
    try {
        // 1. Cargar pronósticos de los participantes
        const responsePart = await fetch('data/participants.json');
        if (!responsePart.ok) throw new Error('No se pudo cargar participants.json');
        const participants = await responsePart.json();
        
        // 2. Conectar a la API real
        let realResults = [];
        try {
            const responseApi = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
                method: 'GET',
                headers: {
                    "x-apisports-key": API_KEY
                }
            });
            const data = await responseApi.json();
            
            // Si hay partidos en directo, mapeamos los 2 primeros para la prueba
            if (data && data.response && data.response.length > 0) {
                const live1 = data.response[0];
                const live2 = data.response.length > 1 ? data.response[1] : mockRealResults[1];
                
                realResults = [
                    { 
                        matchId: 101, 
                        homeTeam: live1.teams.home.name, 
                        awayTeam: live1.teams.away.name, 
                        homeGoals: live1.goals.home || 0, 
                        awayGoals: live1.goals.away || 0, 
                        status: "FINISHED" 
                    },
                    { 
                        matchId: 102, 
                        homeTeam: live2.teams?.home?.name || live2.homeTeam, 
                        awayTeam: live2.teams?.away?.name || live2.awayTeam, 
                        homeGoals: live2.goals?.home || live2.homeGoals || 0, 
                        awayGoals: live2.goals?.away || live2.awayGoals || 0, 
                        status: "FINISHED" 
                    }
                ];
            } else {
                console.log("No hay partidos en directo ahora mismo. Usando simulación.");
                realResults = mockRealResults;
            }
        } catch (apiError) {
            console.error("Error conectando a la API, usando simulación:", apiError);
            realResults = mockRealResults;
        }

        // 3. Calcular puntos y pintar en pantalla
        const leaderboard = calculateScores(participants, realResults);
        updateLeaderboardUI(leaderboard);
        updateMatchesUI(realResults);

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

// Iniciar al cargar la página
window.addEventListener('DOMContentLoaded', initEngine);
