// Import internal modules
const FS = require('fs');
const Http = require('http');
const Path = require('path');

// Import third party modules
const Express = require('express');
const SocketIO = require('socket.io');
const Multer = require('multer');

// Import custom modules
const { fixText } = require('./textFixer');
require('./iplookup');

// Initialize server
const app = Express();
const server = Http.createServer(app);
const io = SocketIO(server);

// Initialize express file paths
app.use(Express.static(Path.join(__dirname, '../../dist')));
app.use(Express.static(Path.join(__dirname, '../../public')));

// Store data
let prompt = 'Debate voter live 0.0.0';
let team1Name = 'team1', team2Name = 'team2';
let team1Votes = 0, team2Votes = 0;

var printVotes = () => `Current votes: ${team1Votes} : ${team2Votes}`;

var recountVotes = () => {
    var t1v = 0, t2v = 0;
    for (var s in voterPile) {
        if (!voterPile[s]) continue;
        switch (voterPile[s].vote) {
            case -1:
                t1v++;
                break;
            case 1:
                t2v++;
                break;
        }
        // console.log(t1v, t2v);
    }
    team1Votes = t1v;
    team2Votes = t2v;
};

// Process voters (namespace)
const voters = io.of('/voters');
let voterPile = {}; // Store sockets and votes
let prevSock = null;

voters.on('connection', (sock) => {
    console.log(sock === prevSock);
    prevSock = sock;
    voterPile[sock.id] = {
        sock: sock.id,
        vote: 0 // 0 is neutral, <0 is team 1, >0 is team2
    };
    sock.on('ready-to-send', () => {
        sock.emit('ready-to-receive');
        // Log
        console.log(`Voter ${sock.id} is ready`);
    });
    sock.on('select', (side) => {
        voterPile[sock.id].vote = side ? ((side > 0) ? 1 : -1) : 0;
        recountVotes();
        // Confirm socket
        sock.emit('confirm-selection', voterPile[sock.id].vote);
        // Update displays
        displays.emit('update-votes', team1Votes, team2Votes);
        // Log
        console.log(`Voter ${sock.id} chose ${side}\n${printVotes()}`);
    });
    sock.on('comment', (txt) => {
        txt = fixText(txt);
        sock.emit('confirm-comment', txt);
        if (txt && txt !== '') {
            displays.emit('add-comment', txt);
            console.log(`Voter ${sock.id} commented '${txt}'`);
        } else {
            console.log(`Voter ${sock.id} commented empty comment`);
        }
    });
    sock.on('disconnect', () => {
        if (!voterPile[sock.id]) {
            // To address a previous issue when a socket is deleted twice and already gone from voterPile:
            // -> could not read property 'vote' of undefined
            recountVotes();
            console.error('\033[31;1m' + `Voter ${sock.id} has already been deleted from voterPile!\n${printVotes()}` + '\033[0m');
            return;
        }
        // Delete that socket
        delete voterPile[sock.id];
        // Then recount
        recountVotes();
        // Update displays
        displays.emit('update-votes', team1Votes, team2Votes);
        // Log
        console.log(`Voter ${sock.id} is disconnected\n${printVotes()}`);
    });
    // Log
    console.log(`Voter ${sock.id} is connected`);
});

// Process displays (namespace)
const displays = io.of('/displays');

displays.on('connection', (sock) => {
    sock.on('request-update', () => {
        sock.emit('update-info', prompt, team1Name, team2Name);
        sock.emit('update-votes', team1Votes, team2Votes);
        console.log(`Display ${sock.id} requested an update`);
    });
    console.log(`Display ${sock.id} is connected`);
});

// Process setInfo posts
let setInfo = Multer();
let token = '';

var genToken = () => {
    token = '';
    for (var i = 0; i < 4; i++) {
        if (i) token += '-';
        token += Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    }
    console.log(`The new token is ${token}`);
}

genToken();

app.post('/genToken', function (req, res, next) {
    console.log(`${res.ip} requested new token`);
    genToken();
    res.redirect('/info');
})

app.post('/setInfo', setInfo.none(), function (req, res, next) {
    console.dir(req.body, depth = 3);
    if (req.ip === '::1' || req.body.token === token) {
        prompt = req.body.prompt;
        team1Name = req.body.t1ttl;
        team2Name = req.body.t2ttl;
        displays.emit('update-info', prompt, team1Name, team2Name);
    }
    res.redirect('/info');
    if (next) next();
});

server.listen(8080);
console.log('server listening on port 8080');
