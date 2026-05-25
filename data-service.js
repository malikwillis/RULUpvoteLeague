/*
  RUL nuclear JSON repair

  This file fixes site-wide breakage from bad saved local preview data.
  It must load before each page file, which your HTML pages already do:
  static-data.js -> sheet-config.js -> utils.js -> data-service.js -> layout.js -> page file
*/

(function () {
  const BAD_RUL_KEYS = [
    'RUL_WORKING_DATA',
    'RUL_LOCAL_DATA',
    'RUL_PREVIEW_DATA'
  ];

  function isBadSavedValue(value) {
    if (value === undefined || value === null) return false;

    const text = String(value).trim();

    return (
      text === '' ||
      text === 'undefined' ||
      text === 'null' ||
      text === '[object Object]' ||
      text === '"undefined"' ||
      text === '"null"'
    );
  }

  function clearBadRulStorage() {
    BAD_RUL_KEYS.forEach(key => {
      try {
        const value = window.localStorage.getItem(key);

        if (isBadSavedValue(value)) {
          window.localStorage.removeItem(key);
          return;
        }

        if (value) {
          JSON.parse(value);
        }
      } catch (error) {
        try {
          window.localStorage.removeItem(key);
        } catch (_) {}
      }
    });
  }

  clearBadRulStorage();

  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;

  Storage.prototype.getItem = function (key) {
    const value = originalGetItem.call(this, key);

    if (BAD_RUL_KEYS.includes(key) && isBadSavedValue(value)) {
      try {
        this.removeItem(key);
      } catch (_) {}

      return null;
    }

    if (BAD_RUL_KEYS.includes(key) && value) {
      try {
        JSON.parse(value);
      } catch (error) {
        try {
          this.removeItem(key);
        } catch (_) {}

        return null;
      }
    }

    return value;
  };

  Storage.prototype.setItem = function (key, value) {
    if (BAD_RUL_KEYS.includes(key) && isBadSavedValue(value)) {
      try {
        this.removeItem(key);
      } catch (_) {}

      return;
    }

    return originalSetItem.call(this, key, value);
  };

  const originalParse = JSON.parse.bind(JSON);

  JSON.parse = function (value, reviver) {
    if (isBadSavedValue(value)) {
      return window.RUL_STATIC_DATA || null;
    }

    return originalParse(value, reviver);
  };

  window.rulClearLocalPreview = function () {
    BAD_RUL_KEYS.forEach(key => {
      try {
        window.localStorage.removeItem(key);
      } catch (_) {}
    });
  };
})();

async function loadLeagueData() {
  if (window.RUL_STATIC_DATA && typeof window.RUL_STATIC_DATA === 'object') {
    return window.RUL_STATIC_DATA;
  }

  throw new Error('RUL_STATIC_DATA was not found. Check static-data.js is uploaded before data-service.js.');
}

function getWorkingLeagueData() {
  try {
    const saved = localStorage.getItem('RUL_WORKING_DATA');

    if (!saved) {
      return window.RUL_STATIC_DATA;
    }

    const parsed = JSON.parse(saved);

    if (!parsed || typeof parsed !== 'object' || !parsed.teams || !parsed.games) {
      localStorage.removeItem('RUL_WORKING_DATA');
      return window.RUL_STATIC_DATA;
    }

    return parsed;
  } catch (error) {
    localStorage.removeItem('RUL_WORKING_DATA');
    return window.RUL_STATIC_DATA;
  }
}

function saveWorkingLeagueData(data) {
  if (!data || typeof data !== 'object') return false;

  try {
    localStorage.setItem('RUL_WORKING_DATA', JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

function clearWorkingLeagueData() {
  if (typeof window.rulClearLocalPreview === 'function') {
    window.rulClearLocalPreview();
  } else {
    localStorage.removeItem('RUL_WORKING_DATA');
    localStorage.removeItem('RUL_LOCAL_DATA');
    localStorage.removeItem('RUL_PREVIEW_DATA');
  }
}
