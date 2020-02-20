const wordBlackList = [
    [/(a)ss\s*hole/ig, '$1******'],
    [/(b)itch/ig, '$1****'],
    [/(c)um/ig, '$1**'],
    [/(c)unt/ig, '$1***'],
    [/(d)ic?k/ig, '$1***'],
    [/(f)(a|u)ck/ig, '$1***'],
    [/(f)(a|u)(c|k|q)/ig, '$1**'],
    [/(n)igg\w*/ig, '$1*****'],
    [/(sh)ite?/ig, '$1**'],
    [/(sl)ut/ig, '$1**']
];

if (typeof (String.prototype.trim) === "undefined") {
    String.prototype.trim = function () {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

var fixText = function (text, sock = null) {
    var announcement = false;
    // Trim text
    text = text.trim();
    // Tackle long comments
    if (text.length > 400) {
        text = `${sock ? sock.handshake.address : 'ERR_USER_ID'} commented ${text.length} characters`;
        announcement = true;
        // console.dir(sock.handshake.address);
    }
    // Remove bad words
    for (var i = 0; i < wordBlackList.length; i++) {
        text = text.replace(wordBlackList[i][0], wordBlackList[i][1]);
    }
    return [text, announcement];
};

module.exports = {
    fixText: fixText,
};
