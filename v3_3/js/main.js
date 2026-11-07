// はじまり
(function (G) {
  window.addEventListener('DOMContentLoaded', () => {
    G.Field.init(document.getElementById('field'));
    G.UI.init(); G.Tut.init();
  });
})(globalThis.G2 = globalThis.G2 || {});
