(function () {
  var root = document.documentElement;
  var KEY = 'wallcal-site-theme';
  root.classList.add('js');

  var toggle = document.getElementById('theme-toggle');
  function showTheme() {
    var light = root.dataset.theme === 'light';
    toggle.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.textContent = light ? '☀' : '☾';
  }
  showTheme();
  toggle.addEventListener('click', function () {
    var next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    showTheme();
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      // Storage blocked (private mode): the choice lasts for this page view only.
    }
  });

  var button = document.querySelector('button.copy');
  var code = document.getElementById(button.dataset.copy);
  function copied() {
    button.textContent = 'Copied';
    setTimeout(function () {
      button.textContent = 'Copy';
    }, 2000);
  }
  function selectCode() {
    var range = document.createRange();
    range.selectNodeContents(code);
    var selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  button.addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code.textContent).then(copied, selectCode);
    } else {
      selectCode();
    }
  });
})();
