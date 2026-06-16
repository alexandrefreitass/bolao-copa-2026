const STORAGE_KEY = 'bolao_admin_session';

const readStoredSession = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { token: '', model: null };

  try {
    const session = JSON.parse(stored);
    return {
      token: session?.token || '',
      model: session?.model || null,
    };
  } catch {
    return { token: stored, model: null };
  }
};

const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const [payload] = token.split('.');
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + (4 - normalizedPayload.length % 4) % 4, '=');
    const data = JSON.parse(atob(paddedPayload));
    return data.exp ? data.exp <= Date.now() : false;
  } catch {
    return false;
  }
};

const storedSession = readStoredSession();

const authStore = {
  token: storedSession.token,
  model: storedSession.model,
  get isValid() {
    return Boolean(this.token) && !isTokenExpired(this.token);
  },
  save(token, model) {
    this.token = token;
    this.model = model;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, model }));
  },
  clear() {
    this.token = '';
    this.model = null;
    localStorage.removeItem(STORAGE_KEY);
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return true;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) authStore.clear();
    const error = new Error(data.message || 'Erro na requisição');
    error.status = response.status;
    throw error;
  }
  return data;
};

const resourcePath = (name) => `/${name.replaceAll('_', '-')}`;

const collection = (name) => ({
  getFullList: ({ sort = 'created' } = {}) => request(`${resourcePath(name)}?sort=${encodeURIComponent(sort)}`),
  create: (data) => request(resourcePath(name), { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`${resourcePath(name)}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`${resourcePath(name)}/${id}`, { method: 'DELETE' }),
  authWithPassword: async (email, password) => {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authStore.save(data.token, data.user);
    return { record: data.user, token: data.token };
  },
});

const apiClient = { authStore, collection };

export default apiClient;
export { apiClient };
