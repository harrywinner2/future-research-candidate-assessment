/* Real backend API client. In dev VITE_API_BASE points at the FastAPI server;
   in the single-service production image it is empty (same origin). Exposed as
   window.API so the ported modules can use it without imports. */
(function () {
  const BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

  async function req(method, path, { body, query } = {}) {
    let url = BASE + path;
    if (query) {
      const qs = Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      const detail = (data && data.detail) || res.statusText || `HTTP ${res.status}`;
      const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  const API = {
    base: BASE,
    // health / settings
    health: () => req('GET', '/health'),
    getSettings: () => req('GET', '/settings'),
    getLLMSettings: () => req('GET', '/settings/llm'),
    updateLLMSettings: (body) => req('PUT', '/settings/llm', { body }),
    // members
    listMembers: () => req('GET', '/members'),
    getMember: (id) => req('GET', `/members/${encodeURIComponent(id)}`),
    memberGraph: (id, depth = 2) => req('GET', `/members/${encodeURIComponent(id)}/graph`, { query: { depth } }),
    createMember: (body) => req('POST', '/members', { body }),
    spawnPersona: (name) => req('POST', `/members/synthetic/${encodeURIComponent(name)}`),
    // exercises
    listExercises: (query = {}) => req('GET', '/exercises', { query }),
    getExercise: (id, member_id) => req('GET', `/exercises/${encodeURIComponent(id)}`, { query: { member_id } }),
    // graph
    graphSchema: () => req('GET', '/graph/schema'),
    neighbourhood: (query) => req('GET', '/graph/neighbourhood', { query }),
    // ingest
    ingestProfile: (member) => req('POST', '/ingest/profile', { body: member }),
    ingestInjury: (member_id, injury) => req('POST', '/ingest/injury', { body: injury, query: { member_id } }),
    ingestSignal: (member_id, text, signal_type = 'chat') => req('POST', '/ingest/signal', { query: { member_id, text, signal_type } }),
    seed: () => req('POST', '/ingest/seed'),
    // ai pipeline
    retrieve: (body) => req('POST', '/retrieve', { body }),
    recommend: (body) => req('POST', '/recommend', { body }),
    explain: (body) => req('POST', '/explain', { body }),
    log: (body) => req('POST', '/log', { body }),
    // observability + config
    listTraces: (query = {}) => req('GET', '/traces', { query }),
    getTrace: (id) => req('GET', `/traces/${encodeURIComponent(id)}`),
    prompts: () => req('GET', '/prompts'),
    safetyPolicy: () => req('GET', '/safety/policy'),
    safetyPolicies: () => req('GET', '/safety/policies'),
    updateSafetyPolicy: (body) => req('PUT', '/safety/policy', { body }),
    metrics: () => req('GET', '/metrics'),
    evalScenarios: () => req('GET', '/eval/scenarios'),
    runEval: (scenario_id) => req('POST', '/eval/run', { query: { scenario_id } }),
    // sessions
    listSessions: (member_id) => req('GET', '/sessions', { query: { member_id } }),
    getSession: (id) => req('GET', `/sessions/${encodeURIComponent(id)}`),
    createSession: (body) => req('POST', '/sessions', { body }),
    appendMessage: (id, body) => req('POST', `/sessions/${encodeURIComponent(id)}/messages`, { body }),
  };

  window.API = API;
})();
