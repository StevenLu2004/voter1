var getUrlVars = function () {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m, key, value) => { vars[key] = value; });
    return vars;
};

module.exports = getUrlVars();
