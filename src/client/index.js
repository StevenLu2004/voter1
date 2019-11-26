import io from '../../node_modules/socket.io-client/dist/socket.io';

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

/* ******************************* *\
|*              Voter              *|
\* ******************************* */

let btn1, btn2, text, subm, form;
let btnPaused = false, txtPaused = false;

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
    sock.emit('comment', text.value);
    text.value = '';
    text.m_resize();
    pauseComment();
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
};

var initVoterButtons = function () {
    btn1 = document.getElementById('team1');
    btn2 = document.getElementById('team2');

    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', -1);
        pauseButtons();
    };
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', 1);
        pauseButtons();
    };
};

var initVoter = function () {
    sock = io('/voters');
    sock.on('disconnect', () => {
        pauseButtons();
        pauseComment();
    });
    sock.on('connect', () => {
        sock.emit('ready-to-send');
    });
    sock.on('ready-to-receive', () => {
        if (btn1.classList.contains('selected'))
            sock.emit('select', -1);
        else if (btn2.classList.contains('selected'))
            sock.emit('select', 1);
        else
            sock.emit('select', 0);
        unpauseComment();
    });
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
    sock.on('confirm-comment', (txt) => {
        unpauseComment();
    });

    initVoterButtons();
    initVoterComment();

    pauseButtons();
    pauseComment();
}

// Use sock.on('confirm-selection') to call these
var chooseTeam1 = function () {
    btn1.classList.add('selected');
    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', 0);
        pauseButtons();
    };
    btn2.classList.remove('selected');
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', 1);
        pauseButtons();
    };
};
var chooseTeam2 = function () {
    btn1.classList.remove('selected');
    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', -1);
        pauseButtons();
    };
    btn2.classList.add('selected');
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', 0);
        pauseButtons();
    };
};
var deselect = function () {
    btn1.classList.remove('selected');
    btn1.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', -1);
        pauseButtons();
    };
    btn2.classList.remove('selected');
    btn2.onclick = () => {
        if (btnPaused) return;
        sock.emit('select', 1);
        pauseButtons();
    };
};

/* ********************************* *\
|*              Display              *|
\* ********************************* */

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
            this.t1Score.innerText = String(Math.round(t1sc * 100 / (t1sc + t2sc))) + '%';
            this.t2Score.innerText = String(Math.round(t2sc * 100 / (t1sc + t2sc))) + '%';
            this.t1Rect.style.flex = t1sc;
            this.t2Rect.style.flex = t2sc;
        }
    };
    lScore = {
        t1Score: document.getElementById('team1-v-score'),
        t1Rect: document.getElementById('team1-v-rect'),
        t2Rect: document.getElementById('team1-v-space'),
        updateScore: function (t1sc, t2sc) {
            this.t1Score.innerText = String(Math.round(t1sc * 100 / (t1sc + t2sc))) + '%';
            // this.t2Score.innerText = String(Math.round(t2sc * 100 / (t1sc + t2sc))) + '%';
            this.t1Rect.style.flex = t1sc;
            this.t2Rect.style.flex = t2sc;
        }
    };
    rScore = {
        t2Score: document.getElementById('team2-v-score'),
        t1Rect: document.getElementById('team2-v-space'),
        t2Rect: document.getElementById('team2-v-rect'),
        updateScore: function (t1sc, t2sc) {
            // this.t1Score.innerText = String(Math.round(t1sc * 100 / (t1sc + t2sc))) + '%';
            this.t2Score.innerText = String(Math.round(t2sc * 100 / (t1sc + t2sc))) + '%';
            this.t1Rect.style.flex = t1sc;
            this.t2Rect.style.flex = t2sc;
        }
    };
    comments = {
        idealContainer: document.getElementById('ideal-container'),
        displayContainer: document.getElementById('display-container'),
        commentArea: document.getElementById('comment-area'),
        addComment: function (txt) {
            if (!txt) return;
            var p = document.createElement('p');
            p.innerText = txt;
            this.commentArea.prepend(p);
            var plst = this.commentArea.childNodes;
            while (this.displayContainer.scrollHeight > this.idealContainer.scrollHeight)
                this.commentArea.removeChild(plst[plst.length - 1]); // Pop from back
        }
    };
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
    sock.on('add-comment', (txt) => comments.addComment(txt));
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

/* ******************************** *\
|*              Onload              *|
\* ******************************** */

observe(window, 'load', function () {
    if (document.getElementById('vote-container')) {
        initVoter();
    } else if (document.getElementById('display-container')) {
        initDisplay();
    }
});
