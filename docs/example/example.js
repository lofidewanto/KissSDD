// Language switch for the KissSDD example pages (EN / DE).
// Same rules as the homepage: ?lang=en|de first, then the last choice, then the browser language.
// Loaded in <head> so the right language shows from the first paint. Without JavaScript, English shows.
(function () {
  var KEY = 'sddkiss-lang';
  var LANGS = { en: true, de: true };

  function initialLang() {
    var lang = null;
    try { lang = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase(); } catch (e) {}
    if (LANGS[lang]) return lang;
    try { lang = localStorage.getItem(KEY); } catch (e) {}
    if (LANGS[lang]) return lang;
    return (navigator.language || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  }

  function setLang(lang, updateUrl) {
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    var title = document.querySelector('title');
    if (title) {
      if (!title.dataset.en) title.dataset.en = title.textContent;
      title.textContent = (lang === 'de' && title.dataset.de) || title.dataset.en;
    }
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.setLang === lang));
    });
    if (updateUrl) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e) {}
    }
  }

  var lang = initialLang();
  document.documentElement.lang = lang;

  document.addEventListener('DOMContentLoaded', function () {
    setLang(lang, false);
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.dataset.setLang, true); });
    });
  });
})();
