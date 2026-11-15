// ThriftLoop API config/helper (for backend integration)
// Set window.THRIFTLOOP_API_BASE before loading, or edit default below.
(function () {
  const DEFAULT_BASE = 'http://localhost:3001';
  const API_BASE = (window.THRIFTLOOP_API_BASE || DEFAULT_BASE).replace(/\/$/, '');

  function getToken() {
    return localStorage.getItem('thriftloop_token');
  }
  function setToken(token) {
    if (token) localStorage.setItem('thriftloop_token', token);
    else localStorage.removeItem('thriftloop_token');
  }
  function authHeaders(extra) {
    const h = Object.assign({}, extra || {});
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }
  async function request(path, options) {
    const opts = Object.assign({ headers: {} }, options || {});
    opts.headers = Object.assign({}, opts.headers);
    const res = await fetch(API_BASE + path, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error((data && (data.error || data.message)) || ('Request failed: ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.ThriftLoopAPI = {
    base: API_BASE,
    getToken, setToken, authHeaders, request,
    url(path) { return API_BASE + path; }
  };
})();
