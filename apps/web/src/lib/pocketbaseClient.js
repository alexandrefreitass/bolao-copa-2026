import Pocketbase from 'pocketbase';

const POCKETBASE_API_URL = import.meta.env.DEV
  ? 'http://localhost:8090'
  : '/hcgi/platform';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
