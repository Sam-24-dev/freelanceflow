(() => {
  'use strict';

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  async function loadJson(url) {
    if (window.location.protocol === 'file:' && window.FreelanceFlowMockData) {
      return clone(window.FreelanceFlowMockData);
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Mock data request failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (window.FreelanceFlowMockData) return clone(window.FreelanceFlowMockData);
      throw error;
    }
  }

  window.FreelanceFlowDataLoader = { loadJson, clone };
})();
