import { PostgresStore } from '../storage/postgres';
import { configureEquipmentStore, handleEquipMessage } from '../equip/bot';
if (!process.env.TEST_DATABASE_URL || !process.env.TEST_NAMESPACE) throw new Error('Test database required');
const store = new PostgresStore(process.env.TEST_DATABASE_URL, process.env.TEST_NAMESPACE);
configureEquipmentStore(store);
try { console.log(JSON.stringify(await handleEquipMessage(process.argv[2], 'fixture-user'))); }
finally { await store.close(); }
