import * as migration_20261116_155520_inicial from './20261116_155520_inicial';
import * as migration_20261116_161224_web from './20261116_161224_web';

export const migrations = [
  {
    up: migration_20261116_155520_inicial.up,
    down: migration_20261116_155520_inicial.down,
    name: '20261116_155520_inicial',
  },
  {
    up: migration_20261116_161224_web.up,
    down: migration_20261116_161224_web.down,
    name: '20261116_161224_web'
  },
];
