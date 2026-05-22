// api-engine.js
// Motor para calcular los puntos basados en los pronósticos y los resultados reales simulados

const mockRealResults = [
    { matchId: 101, homeTeam: "España", awayTeam: "Croacia", homeGoals: 3, awayGoals: 0, status: "FINISHED" },
    { matchId: 102, homeTeam: "Brasil", awayTeam: "Serbia", homeGoals: 2, awayGoals: 0, status: "FINISHED" }
];

// Función principal que inicializa el motor
async function initEngine() {
    try {
        // En el futuro, fetch('/porra/data/participants.json')
        const response = await fetch('data/participants.json');
        if (!response.ok) throw new Error('No se pudo cargar participants.json');
        const participants = await response.json();
        
        const leaderboard = calculateScores(participants, mockRealResults);
        updateLeaderboardUI(leaderboard);
        updateMatchesUI(mockRealResults);

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
