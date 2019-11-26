const wordBlackList = [
    [/(a)ss\s*hole/ig, '$1******'],
    [/(b)itch/ig, '$1****'],
    [/(c)um/ig, '$1**'],
    [/(c)unt/ig, '$1***'],
    [/(d)ic?k/ig, '$1***'],
    [/(f)(a|u)ck/ig, '$1***'],
    [/(f)(a|u)(c|k|q)/ig, '$1**'],
    [/(n)igg\w*/ig, '$1*****'],
    [/(s)hite?/ig, '$1h**']
];

var fixText = function (text) {
    // Remove bad words
    for (var i = 0; i < wordBlackList.length; i++) {
        text = text.replace(wordBlackList[i][0], wordBlackList[i][1]);
    }
    return text;
};

module.exports = {
    fixText: fixText
};
