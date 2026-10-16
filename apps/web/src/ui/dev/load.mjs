// Prints a one-line machine load/memory snapshot (for heavy-suite logs). Usage: node apps/web/src/ui/dev/load.mjs <label>
import { cpus, freemem, loadavg, totalmem } from 'node:os';
const [l1, l5, l15] = loadavg().map((x) => x.toFixed(2));
const gb = (b) => (b / 2 ** 30).toFixed(1);
console.log(`[load] ${process.argv[2] ?? ''} ${new Date().toISOString()} load1/5/15=${l1}/${l5}/${l15} cpus=${cpus().length} mem free=${gb(freemem())}GB of ${gb(totalmem())}GB`);
