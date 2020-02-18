// MARK: manage server ID updates here

const THIS_RUN_TIME = (new Date()).valueOf();

let idTot = 0;

let id2ip = {}, ip2id = {};

var idConnect = function (sock, voterID, prevConnect) {
    if (ip2id[sock.handshake.address]) {
        // The IP is already there
        console.log(sock.handshake.address)
        console.dir(ip2id);
        return -2;
    }
    if (prevConnect < THIS_RUN_TIME || isNaN(voterID) || Number(voterID) > idTot) {
        // The ID is from the last session
        voterID = String(++idTot); // Start from 1
        prevConnect = THIS_RUN_TIME;
        id2ip[voterID] = sock.handshake.address; // Store IP by ID
        ip2id[sock.handshake.address] = voterID; // Store ID by IP
        return voterID;
    }
    if (id2ip[voterID]) {
        // The ID is already there
        console.log(voterID)
        console.dir(id2ip);
        return -1;
    }
    id2ip[voterID] = sock.handshake.address; // Store IP by ID
    ip2id[sock.handshake.address] = voterID; // Store ID by IP
    return voterID;
};

var getId = function (ip) {
    return ip2id[ip];
};

var getIp = function (id) {
    return id2ip[id];
};

var idDisconnect = function (sock) {
    var id = ip2id[sock.handshake.address];
    console.log(`Unlinking ID ${id} and IP ${sock.handshake.address}`)
    // Set both to undefined
    id2ip[id] = undefined;
    ip2id[sock.handshake.address] = undefined;
    console.dir(id2ip);
    console.dir(ip2id);
};

module.exports = {
    THIS_RUN_TIME: THIS_RUN_TIME,
    idConnect: idConnect,
    getId: getId,
    getIp: getIp,
    idDisconnect: idDisconnect,
};
