/* 英語版(2026-11-11)。英語の端末のとき、アプリが tottery-honor-start と一緒に辞書(config.i18n)を渡す。
   画面の文と alt・aria-label・title を、出たそばから辞書で差し替える。日本語の端末では何もしない */
(function () {
  var dict = null, pats = [];
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function tr(s) {
    if (!dict || !s) return null;
    var t = s.trim();
    if (!t) return null;
    if (Object.prototype.hasOwnProperty.call(dict, t)) return s.replace(t, dict[t]);
    for (var i = 0; i < pats.length; i++) {
      var m = pats[i].re.exec(t);
      if (!m) continue;
      var out = pats[i].en;
      pats[i].names.forEach(function (n, j) {
        var v = m[j + 1];
        out = out.split("{" + n + "}").join(Object.prototype.hasOwnProperty.call(dict, v) ? dict[v] : v);
      });
      return s.replace(t, out);
    }
    return null;
  }
  var ATTRS = ["alt", "aria-label", "title"];
  function fix(node) {
    if (node.nodeType === 3) {
      var v = tr(node.nodeValue);
      if (v !== null && v !== node.nodeValue) node.nodeValue = v;
      return;
    }
    if (node.nodeType !== 1) return;
    ATTRS.forEach(function (a) {
      if (!node.hasAttribute(a)) return;
      var v = tr(node.getAttribute(a));
      if (v !== null && v !== node.getAttribute(a)) node.setAttribute(a, v);
    });
    for (var c = node.firstChild; c; c = c.nextSibling) fix(c);
  }
  function start(d) {
    dict = d;
    Object.keys(d).forEach(function (k) {
      if (!/\{\w+\}/.test(k)) return;
      var names = [];
      var src = k.split(/(\{\w+\})/).map(function (p) {
        var m = /^\{(\w+)\}$/.exec(p);
        if (!m) return esc(p);
        names.push(m[1]);
        return "([\\s\\S]+?)";
      }).join("");
      pats.push({ re: new RegExp("^" + src + "$"), names: names, en: d[k], literal: k.replace(/\{\w+\}/g, "").length });
    });
    pats.sort(function (a, b) { return b.literal - a.literal; });
    document.documentElement.lang = "en";
    fix(document.documentElement);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "characterData") fix(m.target);
        else if (m.type === "attributes") fix(m.target);
        else m.addedNodes.forEach(fix);
      });
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "tottery-honor-start") return;
    var d = e.data.config && e.data.config.i18n;
    if (d && !dict) start(d);
  });
})();
