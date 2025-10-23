// Supabase configuration
const SUPABASE_URL = 'https://wnebyvojwnjrqecjlyhy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZWJ5dm9qd25qcnFlY2pseWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODgxNDIsImV4cCI6MjA3NjY2NDE0Mn0.F-4VLFeqB_WT26n4fI4XeZan6OBn1x8e5PwXyD71McU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Game state
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;

// Winning combinations
const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]              // Diagonals
];

// DOM elements
const cells = document.querySelectorAll('.cell');
const currentPlayerDisplay = document.getElementById('currentPlayer');
const gameStatus = document.getElementById('gameStatus');
const resetBtn = document.getElementById('resetBtn');
const totalGamesDisplay = document.getElementById('totalGames');
const xWinsDisplay = document.getElementById('xWins');
const oWinsDisplay = document.getElementById('oWins');
const drawsDisplay = document.getElementById('draws');
const leaderboardList = document.getElementById('leaderboardList');

// Initialize game
function init() {
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
    resetBtn.addEventListener('click', resetGame);

    loadStats();
    loadLeaderboard();

    // Subscribe to real-time updates
    subscribeToGameUpdates();
}

// Handle cell click
function handleCellClick(e) {
    const index = e.target.dataset.index;

    if (board[index] !== '' || !gameActive) {
        return;
    }

    board[index] = currentPlayer;
    e.target.textContent = currentPlayer;
    e.target.classList.add('taken', currentPlayer.toLowerCase());

    const winner = checkWinner();

    if (winner) {
        gameActive = false;
        handleGameEnd(winner);
    } else if (board.every(cell => cell !== '')) {
        gameActive = false;
        handleGameEnd('draw');
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        currentPlayerDisplay.textContent = currentPlayer;
    }
}

// Check for winner
function checkWinner() {
    for (const combo of winningCombinations) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            // Highlight winning cells
            cells[a].classList.add('winning');
            cells[b].classList.add('winning');
            cells[c].classList.add('winning');
            return board[a];
        }
    }
    return null;
}

// Handle game end
async function handleGameEnd(winner) {
    if (winner === 'draw') {
        gameStatus.textContent = "It's a Draw! 🤝";
    } else {
        gameStatus.textContent = `Player ${winner} Wins! 🎉`;
    }

    // Save to database
    await saveGame(winner);

    // Reload stats and leaderboard
    await loadStats();
    await loadLeaderboard();
}

// Save game to Supabase
async function saveGame(winner) {
    try {
        const { data, error } = await supabase
            .from('games')
            .insert([
                { winner: winner === 'draw' ? 'draw' : winner }
            ]);

        if (error) throw error;

        console.log('Game saved successfully');
    } catch (error) {
        console.error('Error saving game:', error);
        gameStatus.textContent += ' (Failed to save to database)';
    }
}

// Load statistics
async function loadStats() {
    try {
        // Get total games
        const { count: totalCount, error: countError } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        totalGamesDisplay.textContent = totalCount || 0;

        // Get X wins
        const { count: xCount, error: xError } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('winner', 'X');

        if (xError) throw xError;
        xWinsDisplay.textContent = xCount || 0;

        // Get O wins
        const { count: oCount, error: oError } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('winner', 'O');

        if (oError) throw oError;
        oWinsDisplay.textContent = oCount || 0;

        // Get draws
        const { count: drawCount, error: drawError } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('winner', 'draw');

        if (drawError) throw drawError;
        drawsDisplay.textContent = drawCount || 0;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const { data, error } = await supabase
            .from('games')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            leaderboardList.innerHTML = '<div class="loading">No games played yet. Be the first!</div>';
            return;
        }

        leaderboardList.innerHTML = data.map((game, index) => {
            const resultText = game.winner === 'draw' ? 'Draw' : `${game.winner} Won`;
            const resultClass = game.winner === 'draw' ? 'draw' :
                               game.winner === 'X' ? 'x-win' : 'o-win';
            const timeAgo = getTimeAgo(new Date(game.created_at));

            return `
                <div class="leaderboard-item">
                    <div>
                        <span style="color: #999; margin-right: 10px;">#${index + 1}</span>
                        <span class="game-result ${resultClass}">${resultText}</span>
                    </div>
                    <span class="game-time">${timeAgo}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardList.innerHTML = '<div class="error">Failed to load games</div>';
    }
}

// Subscribe to real-time updates
function subscribeToGameUpdates() {
    supabase
        .channel('games')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'games' },
            payload => {
                console.log('New game added:', payload);
                loadStats();
                loadLeaderboard();
            }
        )
        .subscribe();
}

// Get time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// Reset game
function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('taken', 'x', 'o', 'winning');
    });

    currentPlayerDisplay.textContent = currentPlayer;
    gameStatus.textContent = '';
}

// Initialize on page load
init();
