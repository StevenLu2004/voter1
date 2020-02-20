import io from '../../node_modules/socket.io-client/dist/socket.io';

import URL_VARS from './urlvars';
import { getCookie, setCookie } from './cookiemgr';

import './css/voter.css';
import './css/display.css';

// Universal socket
let sock;

// Universal addEventListener
var observe;
if (window.attachEvent) {
    observe = function (element, event, handler) {
        element.attachEvent('on' + event, handler);
    };
}
else {
    observe = function (element, event, handler) {
        element.addEventListener(event, handler, false);
    };
}

// MARK: Voter

let btn1, btn2, text, subm, form;
let btnPaused = false, txtPaused = false;

let voterID, voterLastConnect;

var pauseButtons = function () {
    btn1.disabled = btn2.disabled = true;
    btnPaused = true;
};
var unpauseButtons = function () {
    btn1.disabled = btn2.disabled = false;
    btnPaused = false;
};
var pauseComment = function () {
    text.disabled = subm.disabled = true;
    txtPaused = true;
};
var unpauseComment = function () {
    text.disabled = subm.disabled = false;
    txtPaused = false;
};

var leaveComment = function (e) {
    e.preventDefault();
    if (txtPaused) return;
    sock.emit('comment', voterID, text.value);
    text.value = '';
    text.m_resize();
    pauseComment();
};

var commentTextEnterDetection = function (e) {
    var k = e.keyCode;
    if (k == 13)
        window.setTimeout(() => {
            text.m_resize();
            leaveComment(e);
        }, 1);
};

var initVoterCommentAutoresize = function () {
    text.m_resize = function () {
        text.value = text.value.replace(/\r?\n/g, '').replace(/\t/g, ''); // No new line, no tabs
        text.style.height = 'auto';
        text.style.height = text.scrollHeight + 'px';
    };
    /* 0-timeout to get the already changed text */
    text.m_delayedResize = function () {
        window.setTimeout(text.m_resize, 0);
    };

    observe(text, 'change', text.m_resize);
    observe(text, 'cut', text.m_delayedResize);
    observe(text, 'paste', text.m_delayedResize);
    observe(text, 'drop', text.m_delayedResize);
    observe(text, 'keydown', text.m_delayedResize);

    // text.focus();
    // text.select();
    text.m_resize();
};

var initVoterComment = function () {
    text = document.getElementById('text');
    subm = document.getElementById('comment-submit');
    initVoterCommentAutoresize();
    form = document.getElementById('comment-form');
    observe(form, 'submit', leaveComment);
    observe(text, 'keydown', commentTextEnterDetection);
};

var initVoterButtons = function () {
    btn1 = document.getElementById('team1');
    btn2 = document.getElementById('team2');

    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, -1);
        pauseButtons();
    };
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, 1);
        pauseButtons();
    };
};

var recoverVoterID = function () {
    voterID = getCookie("voter-id");
    voterLastConnect = getCookie("last-connect");
    voterLastConnect = voterLastConnect ? Number(voterLastConnect) : -1;
};

var updateVoterID = function () { // Lasts 10 years
    setCookie('voter-id', voterID, 3650);
    setCookie('last-connect', voterLastConnect, 3650);
};

var initVoter = function () {
    // Attempt to recover voter ID from last session
    recoverVoterID();
    // Initialize socket object; no better ways
    sock = io('/voters');
    // Design of stability
    // Enable the developer/manager to cut off connections when a change to the server must be made
    sock.on('disconnect', () => {
        pauseButtons();
        pauseComment();
    });
    // Handshake-like protocol
    // ID request
    sock.on('connect', () => {
        sock.emit('ready-to-send', voterID, voterLastConnect);
    });
    // Handshake part 3, recover choices
    // TODO: let server help to recover choices instead
    sock.on('ready-to-receive', (newID, thisConnect) => {
        [voterID, voterLastConnect] = [newID, thisConnect]; // ES6 mass assignment
        updateVoterID();
        unpauseComment(); // Choices remain paused until selection is confirmed by server. This whole part might change in the future.
    });
    sock.on('ip-or-id-rejected', () => {
        // Redirect; shouldn't mind this anymore // TODO: a reject.html
        location.pathname = 'reject.html';
    });
    // Selection handshake part 2
    sock.on('confirm-selection', (side) => {
        switch (side) {
            case 0:
                deselect();
                break;
            case -1:
                chooseTeam1();
                break;
            case 1:
                chooseTeam2();
                break;
            default:
                // Do nothing
                break;
        }
        unpauseButtons();
    });
    // Comment handshake part 2
    sock.on('confirm-comment', (txt) => {
        unpauseComment();
    });

    initVoterButtons();
    initVoterComment();

    pauseButtons();
    pauseComment();
};

// Use sock.on('confirm-selection') to call these
var chooseTeam1 = function () {
    btn1.classList.add('selected');
    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, URL_VARS.old ? 0 : -1);
        pauseButtons();
    };
    btn2.classList.remove('selected');
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, 1);
        pauseButtons();
    };
};
var chooseTeam2 = function () {
    btn1.classList.remove('selected');
    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, -1);
        pauseButtons();
    };
    btn2.classList.add('selected');
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, URL_VARS.old ? 0 : 1);
        pauseButtons();
    };
};
var deselect = function () {
    btn1.classList.remove('selected');
    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, -1);
        pauseButtons();
    };
    btn2.classList.remove('selected');
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', voterID, 1);
        pauseButtons();
    };
};

// MARK: Display

let title, hScore, lScore, rScore, comments;
var initDisplay = function () {
    title = {
        prompt: document.getElementById('prompt'),
        team1Title: document.getElementById('team1-title'),
        team2Title: document.getElementById('team2-title'),
        updateInfo: function (promptTxt, t1ttlTxt, t2ttlTxt) {
            this.prompt.innerText = promptTxt;
            this.team1Title.innerText = t1ttlTxt;
            this.team2Title.innerText = t2ttlTxt;
        }
    };
    hScore = {
        t1Score: document.getElementById('team1-h-score'),
        t2Score: document.getElementById('team2-h-score'),
        t1Rect: document.getElementById('team1-h-rect'),
        t2Rect: document.getElementById('team2-h-rect'),
        updateScore: function (t1sc, t2sc) {
            // this.t1Score.innerText = String(Math.round(t1sc * 100 / (t1sc + t2sc))) + '%';
            // this.t2Score.innerText = String(Math.round(t2sc * 100 / (t1sc + t2sc))) + '%';
            this.t1Score.innerText = t1sc;
            this.t2Score.innerText = t2sc;
            this.t1Rect.style.flex = t1sc;
            this.t2Rect.style.flex = t2sc;
        }
    };
    lScore = {
        t1Score: document.getElementById('team1-v-score'),
        t1Rect: document.getElementById('team1-v-rect'),
        t2Rect: document.getElementById('team1-v-space'),
        updateScore: function (t1sc, t2sc) {
            // this.t1Score.innerText = String(Math.round(t1sc * 100 / (t1sc + t2sc))) + '%';
            // // this.t2Score.innerText = String(Math.round(t2sc * 100 / (t1sc + t2sc))) + '%';
            this.t1Score.innerText = t1sc;
            // this.t2Score.innerText = t2sc;
            this.t1Rect.style.flex = t1sc;
            this.t2Rect.style.flex = t2sc;
        }
    };
    rScore = {
        t2Score: document.getElementById('team2-v-score'),
        t1Rect: document.getElementById('team2-v-space'),
        t2Rect: document.getElementById('team2-v-rect'),
        updateScore: function (t1sc, t2sc) {
            // // this.t1Score.innerText = String(Math.round(t1sc * 100 / (t1sc + t2sc))) + '%';
            // this.t2Score.innerText = String(Math.round(t2sc * 100 / (t1sc + t2sc))) + '%';
            // this.t1Score.innerText = t1sc;
            this.t2Score.innerText = t2sc;
            this.t1Rect.style.flex = t1sc;
            this.t2Rect.style.flex = t2sc;
        }
    };
    comments = {
        idealContainer: document.getElementById('ideal-container'),
        displayContainer: document.getElementById('display-container'),
        commentArea: document.getElementById('comment-area'),
        addComment: function (txt, announcement) {
            if (!txt) return;
            var p = document.createElement('p');
            p.innerText = txt;
            if (announcement) p.style.color = 'red';
            else p.style.fontFamily = "'Comic Sans MS', 'Comic Sans', Arial, Helvetica, sans-serif";
            this.commentArea.prepend(p);
        },
    };
    var deleteOldComments = function () {
        var plst = comments.commentArea.childNodes;
        var removed = 0;
        while (comments.displayContainer.scrollHeight > comments.idealContainer.scrollHeight) {
            comments.commentArea.removeChild(plst[plst.length - 1]); // Pop from back
            removed++;
        }
        removed && console.log(`Removed ${removed} comments`);
    };
    comments.deleteInterval = window.setInterval(deleteOldComments, 20); // More stable deletion, doesn't crash in css animation
    console.log(comments.deleteInterval);
    sock = io('/displays');
    sock.on('connect', () => {
        sock.emit('request-update');
    });
    sock.on('update-info', (pr, t1, t2) => title.updateInfo(pr, t1, t2));
    sock.on('update-votes', (t1sc, t2sc) => {
        hScore.updateScore(t1sc, t2sc);
        lScore.updateScore(t1sc, t2sc);
        rScore.updateScore(t1sc, t2sc);
    });
    sock.on('add-comment', (txt, announcement) => comments.addComment(txt, announcement));
    var pickHV = () => {
        if (window.innerWidth < 700) {
            document.getElementById("h-scoreboard").style.display = "flex";
            document.getElementById("l-scoreboard").style.display = "none";
            document.getElementById("r-scoreboard").style.display = "none";
        } else {
            document.getElementById("h-scoreboard").style.display = "none";
            document.getElementById("l-scoreboard").style.display = "flex";
            document.getElementById("r-scoreboard").style.display = "flex";
        }
    };
    observe(window, 'resize', pickHV);
    pickHV();
};

// MARK: Onload

observe(window, 'load', function () {
    if (document.getElementById('vote-container')) {
        initVoter();
    } else if (document.getElementById('display-container')) {
        initDisplay();
    }
});
