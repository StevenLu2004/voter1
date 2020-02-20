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
let ipBanned = {};
let ipToVoter = {}; // Look up socket objects with ip
let idBanned = {};
let idToVoter = {}; // Look up socket objects with id

voters.on('connection', (sock) => {
    if (ipBanned[sock.handshake.address]) {
        sock.emit('ip-or-id-rejected');
        return;
    }
    sock.on('ready-to-send', (voterID, prevConnect) => {
        voterID = IdMgr.idConnect(sock, voterID, prevConnect);
        if (voterID > 0) {
            if (idBanned[voterID]) {
                sock.emit('ip-or-id-rejected');
                return;
            }
            if (!voterPile[voterID]) // Create if non-existing
                voterPile[voterID] = { // Now accessed with voter ID
                    vote: 0,
                };
            sock.emit('ready-to-receive', voterID, IdMgr.THIS_RUN_TIME); // Pass back new voter ID // TODO: accept new voter ID in client
            sock.emit('confirm-selection', voterPile[voterID].vote);
            voterSocks[sock.id] = 1;
            ipToVoter[sock.handshake.address] = sock;
            idToVoter[voterID] = sock;
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
        var announcement;
        [txt, announcement] = fixText(txt, sock);
        sock.emit('confirm-comment', txt);
        if (txt && txt !== '') {
            displays.emit('add-comment', txt, announcement);
            console.log(`Voter ${sock.handshake.address} ${voterID} commented '${txt}'`);
        } else {
            console.log(`Voter ${sock.handshake.address} ${voterID} commented empty comment`);
        }
    });
    sock.on('disconnect', () => {
        if (voterSocks[sock.id]) {
            voterSocks[sock.id] = undefined;
            idToVoter[IdMgr.getId(sock.handshake.address)] = undefined;
            ipToVoter[sock.handshake.address] = undefined;
            IdMgr.idDisconnect(sock); // Delete ID-IP linkage // No delete data; cookie data persistence until next server runtime!
            console.log(`Voter ${sock.handshake.address} is disconnected`);
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
        sock.emit('add-comment', 'The vote display is connected.', true);
        console.log(`Display ${sock.id} requested an update`);
    });
    console.log(`Display ${sock.id} is connected`);
});

// Process setInfo posts
let setInfo = Multer();
let banIp = Multer();
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

app.post('/banIp', banIp.none(), function (req, res, next) {
    console.dir(req.body, depth = 3);
    if (req.ip === '::1' || req.body.token === token) {
        if (req.body.id) {
            id = req.body.ip;
            if (idBanned[id]) {
                idBanned[id] = undefined;
                displays.emit('add-comment', `ID ${id} has been unbanned by the administrator.`, true);
            } else {
                idBanned[id] = true;
                if (idToVoter[id])
                    idToVoter[id].emit('ip-or-id-rejected');
                displays.emit('add-comment', `ID ${id} has been banned by the administrator.`, true);
            }
        } else {
            ip = req.body.ip;
            if (ipBanned[ip]) {
                ipBanned[ip] = undefined;
                displays.emit('add-comment', `${ip} has been unbanned by the administrator.`, true);
            } else {
                ipBanned[ip] = true;
                if (ipToVoter[ip])
                    ipToVoter[ip].emit('ip-or-id-rejected');
                displays.emit('add-comment', `${ip} has been banned by the administrator.`, true);
            }
        }
    }
    res.redirect('/info');
    if (next) next();
});

server.listen(8080);
console.log('server listening on port 8080');
