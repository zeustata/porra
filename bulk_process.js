const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const participantesDir = 'c:\\Users\\NUC\\Downloads\\IA\\porras\\participantes';
const dbPath = 'c:\\Users\\NUC\\Downloads\\IA\\porras\\data\\participants.json';

// Standard mapping for team codes
const normalizedTeamMap = {
    'mexico': 'MEX',
    'sudafrica': 'RSA',
    'coreadelsur': 'KOR',
    'republicacheca': 'CZE',
    'suiza': 'SUI',
    'canada': 'CAN',
    'bosniayherzegovina': 'BIH',
    'qatar': 'QAT',
    'brasil': 'BRA',
    'marruecos': 'MAR',
    'escocia': 'SCO',
    'haiti': 'HAI',
    'eeuu': 'USA',
    'paraguay': 'PAR',
    'turquia': 'TUR',
    'australia': 'AUS',
    'alemania': 'GER',
    'ecuador': 'ECU',
    'costademarfil': 'CIV',
    'curazao': 'CUR',
    'paisesbajos': 'NED',
    'japon': 'JPN',
    'suecia': 'SWE',
    'tunez': 'TUN',
    'belgica': 'BEL',
    'iran': 'IRN',
    'egipto': 'EGY',
    'nuevazelanda': 'NZL',
    'espana': 'ESP',
    'uruguay': 'URY',
    'arabiasaudi': 'KSA',
    'caboverde': 'CPV',
    'francia': 'FRA',
    'noruega': 'NOR',
    'senegal': 'SEN',
    'irak': 'IRQ',
    'argentina': 'ARG',
    'austria': 'AUT',
    'argelia': 'ALG',
    'jordania': 'JOR',
    'portugal': 'POR',
    'colombia': 'COL',
    'uzbekistan': 'UZB',
    'rdcongo': 'COD',
    'croacia': 'CRO',
    'inglaterra': 'ENG',
    'ghana': 'GHA',
    'panama': 'PAN'
};

function getTeamCode(rawName) {
    if (!rawName) return null;
    let cleaned = rawName.replace(/^\d+\s*/, "").replace(/\s*\d+$/, "").trim();
    cleaned = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    cleaned = cleaned.toLowerCase().replace(/[^a-z]/g, "");
    
    if (cleaned.startsWith('hai')) return 'HAI';
    if (cleaned.startsWith('argen')) return 'ARG';
    
    return normalizedTeamMap[cleaned] || null;
}

function getParticipantInfo(jNumber, extractedName) {
    let targetId = jNumber;
    if (jNumber === 1) targetId = 2; // Hevia
    else if (jNumber === 2) targetId = 3; // Acebal
    else if (jNumber === 3) targetId = 1; // Lode (Lendo)
    else targetId = jNumber;

    let formattedName = extractedName.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
        
    if (targetId === 1) {
        formattedName = "Lendo";
    }
    
    return { id: targetId, name: formattedName };
}

async function main() {
    // 1. Read existing participants.json to get template matches and template questions
    const currentData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const lendoTemplate = currentData.find(p => p.id === 1);
    
    if (!lendoTemplate) {
        console.error("Error: Could not find template participant with ID 1");
        process.exit(1);
    }
    
    const templateMatches = lendoTemplate.predictions.matches;
    const templateQuestions = lendoTemplate.predictions.specialQuestionsAnswers;
    
    // 2. Read all files in participantes/
    const files = fs.readdirSync(participantesDir).filter(f => f.endsWith('.pdf') && f.startsWith('J'));
    files.sort((a, b) => {
        const numA = parseInt(a.match(/^J(\d+)/)[1]);
        const numB = parseInt(b.match(/^J(\d+)/)[1]);
        return numA - numB;
    });
    
    const matchRegex = /(\d+)\s*\t\s*(\d+)\s+(1|X|2)/;
    const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    
    const parsedParticipants = [];
    
    for (const file of files) {
        const jNumber = parseInt(file.match(/^J(\d+)/)[1]);
        const filePath = path.join(participantesDir, file);
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        const lines = result.text.split('\n');
        
        const extractedName = lines[0].trim();
        const { id, name } = getParticipantInfo(jNumber, extractedName);
        
        console.log(`Parsing J${jNumber} -> ID: ${id}, Name: ${name}...`);
        
        const matchLines = lines.filter(l => /^\d{1,2}\/\d{1,2}\/\d{2}/.test(l));
        if (matchLines.length !== 72) {
            console.error(`Error in J${jNumber}: Expected 72 matches, found ${matchLines.length}`);
            process.exit(1);
        }
        
        // Match predictions
        const participantMatches = JSON.parse(JSON.stringify(templateMatches));
        for (let i = 0; i < 72; i++) {
            const m = matchLines[i].match(matchRegex);
            if (!m) {
                console.error(`Error in J${jNumber}: match line ${i} regex failed: "${matchLines[i]}"`);
                process.exit(1);
            }
            participantMatches[i].homeGoals = parseInt(m[1]);
            participantMatches[i].awayGoals = parseInt(m[2]);
            participantMatches[i].sign = m[3];
        }
        
        // Group standings
        const groupStandings = {};
        for (let g = 0; g < 12; g++) {
            const letter = groupLetters[g];
            const groupLines = matchLines.slice(g * 6, g * 6 + 6);
            const groupText = groupLines.join('\n');
            groupStandings[letter] = [];
            
            for (let pos = 1; pos <= 4; pos++) {
                const posRegex = new RegExp(`${pos}º\\s*\\t*\\s*([^\\t\\r\\n\\dº]+)`);
                const pm = groupText.match(posRegex);
                if (!pm) {
                    console.error(`Error in J${jNumber}: Standing pos ${pos} not found in Group ${letter}`);
                    process.exit(1);
                }
                const teamRaw = pm[1].trim();
                const code = getTeamCode(teamRaw);
                if (!code) {
                    console.error(`Error in J${jNumber}: No team code found for standing "${teamRaw}"`);
                    process.exit(1);
                }
                groupStandings[letter].push(code);
            }
        }
        
        // Special questions
        const specialQuestionsAnswers = JSON.parse(JSON.stringify(templateQuestions));
        let qIndex = 0;
        lines.forEach((line) => {
            if (line.includes('¿')) {
                const regex = /¿([^\t]+)\t([^\t]+)/;
                const m = line.match(regex);
                if (!m) {
                    console.error(`Error in J${jNumber}: failed to parse question line: "${line}"`);
                    process.exit(1);
                }
                const answer = m[2].trim();
                if (qIndex < 26) {
                    specialQuestionsAnswers[qIndex].answer = answer;
                    qIndex++;
                } else {
                    console.error(`Error in J${jNumber}: too many questions found`);
                    process.exit(1);
                }
            }
        });
        
        if (qIndex !== 26) {
            console.error(`Error in J${jNumber}: expected 26 questions, found ${qIndex}`);
            process.exit(1);
        }
        
        parsedParticipants.push({
            id: id,
            name: name,
            predictions: {
                groupStagePoints: 0,
                specialPoints: 0,
                matches: participantMatches,
                groupStandings: groupStandings,
                specialQuestionsAnswers: specialQuestionsAnswers
            }
        });
        
        await parser.destroy();
    }
    
    // Sort final list of participants by ID
    parsedParticipants.sort((a, b) => a.id - b.id);
    
    // 3. Write output to participants.json
    fs.writeFileSync(dbPath, JSON.stringify(parsedParticipants, null, 2), 'utf8');
    console.log(`\nSuccessfully processed and wrote ${parsedParticipants.length} participants to ${dbPath}!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
