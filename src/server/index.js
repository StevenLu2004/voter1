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
const IdMgr = require('./idmgr');
console.log(`The current runtime is ${IdMgr.THIS_RUN_TIME}`);

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
let voterSocks = {}; // Which socket.id's are real voters

// const commentDensityThreshold = 0.25;
// const commentDensityTolerance = 0.995;
// const commentDensityPenaltyRate = 25;
// var blockComment = function (comment) { // antispam
//     comment.lastpass = comment.pass;
//     var timestamp = (new Date()).valueOf() / 1000; // ms to s
//     var timediff = (timestamp - comment.last);
//     comment.density = comment.density * commentDensityTolerance + (1 - commentDensityTolerance) / timediff;
//     comment.density = Math.min(comment.density, commentDensityThreshold);
//     comment.pass = !(comment.density >= commentDensityThreshold && timediff < commentDensityPenaltyRate / comment.lastdiff);
//     comment.lastdiff = timediff;
//     comment.last = timestamp;
//     return !comment.pass;
// };

voters.on('connection', (sock) => {
    sock.on('ready-to-send', (voterID, prevConnect) => {
        voterID = IdMgr.idConnect(sock, voterID, prevConnect);
        if (voterID > 0) {
            if (!voterPile[voterID]) // Create if non-existing
                voterPile[voterID] = { // Now accessed with voter ID
                    vote: 0, // 0 is neutral, <0 is team 1, >0 is team2
                    // comment: {
                    //     last: -1,
                    //     lastdiff: 1e7,
                    //     density: 0,
                    //     pass: true,
                    //     lastpass: true,
                    // },
                };
            sock.emit('ready-to-receive', voterID, IdMgr.THIS_RUN_TIME); // Pass back new voter ID // TODO: accept new voter ID in client
            sock.emit('confirm-selection', voterPile[voterID].vote);
            voterSocks[sock.id] = 1;
            // Log
            console.log(`Voter ${sock.handshake.address} ${voterID} is ready`);
        } else {
            sock.emit('ip-or-id-rejected'); // TODO: handle rejection in client
            console.log(`Voter ${sock.handshake.address} ${voterID} rejected for preexisting ${(voterID == -1) ? 'ID' : 'IP'}`);
        }
    });
    sock.on('select', (voterID, side) => {
        var voterID_ = IdMgr.getId(sock.handshake.address);
        if (!voterSocks[sock.id]) {
            console.log("Improper socket.")
            sock.emit('ip-or-id-rejected');
            return;
        }
        if (!voterID_) {
            console.log("ID not found.")
            sock.emit('ip-or-id-rejected');
            return;
        }
        if (voterID != voterID_) {
            console.log("ID not match.")
            sock.emit('ip-or-id-rejected');
            return;
        }
        voterPile[voterID].vote = side ? ((side > 0) ? 1 : -1) : 0;
        recountVotes();
        // Confirm socket
        sock.emit('confirm-selection', voterPile[voterID].vote);
        // Update displays
        displays.emit('update-votes', team1Votes, team2Votes);
        // Log
        console.log(`Voter ${sock.handshake.address} ${voterID} chose ${side}\n${printVotes()}`);
    });
    sock.on('comment', (voterID, txt) => {
        var voterID_ = IdMgr.getId(sock.handshake.address);
        if (!voterSocks[sock.id]) {
            console.log("Improper socket.")
            sock.emit('ip-or-id-rejected');
            return;
        }
        if (!voterID_) {
            console.log("ID not found.")
            sock.emit('ip-or-id-rejected');
            return;
        }
        if (voterID != voterID_) {
            console.log("ID not match.")
            sock.emit('ip-or-id-rejected');
            return;
        }
        txt = fixText(txt, sock);
        sock.emit('confirm-comment', txt);
        if (txt && txt !== '') {
            displays.emit('add-comment', txt);
            console.log(`Voter ${sock.handshake.address} ${voterID} commented '${txt}'`);
        } else {
            console.log(`Voter ${sock.handshake.address} ${voterID} commented empty comment`);
        }
    });
    sock.on('disconnect', () => {
        if (voterSocks[sock.id]) {
            voterSocks[sock.id] = undefined;
            IdMgr.idDisconnect(sock); // Delete ID-IP linkage // No delete data; cookie data persistence until next server runtime!
            // Log
            var voterID = IdMgr.getId(sock.handshake.address);
            console.log(`Voter ${sock.handshake.address} ${voterID} is disconnected`);
        }
    });
    // Log
    console.log(`Voter ${sock.handshake.address} is connected`);
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
